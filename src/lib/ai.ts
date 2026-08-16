import { AI_BASE_URL, AI_MODEL, AI_TIMEOUT_MS } from "./constants";
import type { ChatMessage } from "./types";

export interface StreamChatOptions {
  systemPrompt: string;
  messages: ChatMessage[];
  onDelta?: (text: string) => void;
}

const TIMEOUT_MESSAGE =
  "⏱️ **요청 시간 초과**: AI 서버 응답이 느리거나 전송된 데이터 양이 너무 많습니다. 질문을 더 간결하게 하거나, '과거 대화 참고' 선택을 줄여주세요.";

/** OpenAI 호환 API로 스트리밍 답변 요청 (원본과 동일: /v1/chat/completions, stream) */
export async function streamChatCompletion({
  systemPrompt,
  messages,
  onDelta,
}: StreamChatOptions): Promise<string> {
  const apiKey = import.meta.env.VITE_NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("⚠️ NVIDIA_API_KEY가 설정되지 않았습니다.");
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, AI_TIMEOUT_MS);

  try {
    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`AI API 오류 (${res.status}): ${body.slice(0, 200)}`);
    }
    if (!res.body) {
      throw new Error("이 브라우저는 스트리밍 응답을 지원하지 않습니다.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        for (const line of part.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta: string =
              parsed?.choices?.[0]?.delta?.content ??
              parsed?.choices?.[0]?.message?.content ??
              "";
            if (delta) {
              full += delta;
              onDelta?.(delta);
            }
          } catch {
            // 불완전한 JSON 청크는 무시
          }
        }
      }
    }
    return full;
  } catch (e) {
    if (timedOut) throw new Error(TIMEOUT_MESSAGE);
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("요청이 중단되었습니다.");
    }
    throw e instanceof Error ? e : new Error(String(e));
  } finally {
    clearTimeout(timer);
  }
}
