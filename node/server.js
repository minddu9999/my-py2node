// ==========================================
// ⚡ 나만의 AI 전기설비 도우미 - Node.js(Express) 버전
// app.py(Streamlit) 포팅
// ==========================================
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");

// ==========================================
// 🔐 1. 환경변수 / 상수
// ==========================================
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("⚠️ `.env` 파일에서 `SUPABASE_URL` 또는 `SUPABASE_ANON_KEY`를 찾을 수 없습니다.");
  process.exit(1);
}

// RAG 참고 자료 폴더: node/data 가 있으면 사용, 없으면 상위 파이썬 프로젝트의 data/ 사용
const DATA_DIR = process.env.DATA_DIR
  || (fs.existsSync(path.join(__dirname, "data"))
      ? path.join(__dirname, "data")
      : path.join(__dirname, "..", "data"));

const AI_BASE_URL = "https://ollama.com/v1";
const AI_MODEL = "gemma4:31b-cloud";
const AI_TIMEOUT_MS = 120_000;

const BASE_SYSTEM_PROMPT = `너는 전기설비 분야의 친절하고 전문적인 AI 도우미야.
반드시 아래에 제공된 [참고 자료]를 바탕으로 정확하게 답변해줘.
참고한 규정의 항과 파일이름은 말하지 않아도 돼.
[참고 자료]에 답이 없거나 관련 내용이 부족하다면, 보유한 지식을 바탕으로 설명하되 자료에 없다는 점을 안내해줘.
나는 전기기능사, 전기(공사)산업기사, 전기(공사)기사를 응시하려는 학생이야.
문제를 만들어 달라는 질문에는 
문제내용
1.
2.
3.
4.
이 형식으로 4지선다로 만들어줘.

만약 사용자가 이미지를 제공했다면, 이미지의 내용(배선도, 기기 사진, 문제 등)을 먼저 정확하게 분석하고 [참고 자료]와 대조하여 전문적으로 답변해줘.
만약 [과거 대화 참고 자료]가 제공된다면, 사용자의 이전 질문 맥락과 내가 previously 답변한 내용을 고려하여 일관성 있고 연속성 있는 답변을 해줘.
`;

// ==========================================
// 🔧 2. 유틸: 아이디 ↔ 이메일 변환 / 쿠키
// ==========================================
const userIdToEmail = (userId) => `${userId}@myapp.local`;
const emailToUserId = (email) => String(email).split("@")[0];

function parseCookies(req) {
  const out = {};
  const header = req.headers.cookie;
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

const COOKIE_OPTS = { httpOnly: true, sameSite: "lax", path: "/" };

function setAuthCookies(res, accessToken, refreshToken, userId) {
  res.cookie("sb_access_token", accessToken, COOKIE_OPTS);
  res.cookie("sb_refresh_token", refreshToken, COOKIE_OPTS);
  res.cookie("sb_user_id", userId, COOKIE_OPTS);
}

function clearAuthCookies(res) {
  res.clearCookie("sb_access_token", { path: "/" });
  res.clearCookie("sb_refresh_token", { path: "/" });
  res.clearCookie("sb_user_id", { path: "/" });
}

// ==========================================
// 🗄️ 3. Supabase 클라이언트
// ==========================================
// 인증(로그인/회원가입)용 공용 클라이언트
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 로그인 사용자의 RLS 를 적용받는 클라이언트 (요청마다 생성)
function clientForUser(accessToken) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

// 액세스 토큰이 만료된 경우 리프레시 토큰으로 갱신 (GoTrue REST 직접 호출)
async function refreshTokens(refreshToken) {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    if (!data || !data.access_token) return null;
    return data;
  } catch {
    return null;
  }
}

// 쿠키의 토큰으로 로그인 사용자 해석 (만료 시 자동 갱신 → 쿠키 재발급)
async function resolveUser(req, res) {
  const cookies = parseCookies(req);
  const access = cookies.sb_access_token;
  const refresh = cookies.sb_refresh_token;
  if (!access) return null;

  const { data, error } = await anonClient.auth.getUser(access);
  if (!error && data && data.user) {
    return { user: data.user, accessToken: access };
  }

  // 토큰 만료/무효 → 리프레시 시도
  if (refresh) {
    const refreshed = await refreshTokens(refresh);
    if (refreshed && refreshed.user) {
      setAuthCookies(res, refreshed.access_token, refreshed.refresh_token, emailToUserId(refreshed.user.email));
      return { user: refreshed.user, accessToken: refreshed.access_token };
    }
  }

  // 유효하지 않으면 쿠키 삭제 (Python 로직과 동일)
  clearAuthCookies(res);
  return null;
}

// ==========================================
// 📂 4. RAG: data 폴더에서 질문과 관련된 파일 선별
// ==========================================
function loadRelevantData(prompt, dataDir = DATA_DIR, maxFiles = 2, maxCharsPerFile = 2000) {
  if (!fs.existsSync(dataDir)) return "";

  const cleaned = String(prompt)
    .toLowerCase()
    .split("알려줘").join("")
    .split("해주세요").join("")
    .split("설명해줘").join("");
  const promptKeywords = [...new Set(cleaned.split(/\s+/).filter(Boolean))];

  const scoredFiles = [];
  for (const filename of fs.readdirSync(dataDir)) {
    const filePath = path.join(dataDir, filename);
    if (!fs.statSync(filePath).isFile()) continue;
    if (!/\.(txt|md|json|csv)$/i.test(filename)) continue;
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const contentLower = content.toLowerCase();
      const score = promptKeywords.reduce(
        (acc, kw) => acc + (kw.length > 1 && contentLower.includes(kw) ? 1 : 0),
        0
      );
      scoredFiles.push({ filename, content, score });
    } catch (e) {
      console.error(`파일 읽기 오류 (${filename}):`, e.message);
    }
  }

  scoredFiles.sort((a, b) => b.score - a.score);

  const contextTexts = [];
  for (const { filename, content } of scoredFiles.slice(0, maxFiles)) {
    const truncated =
      content.length > maxCharsPerFile
        ? content.slice(0, maxCharsPerFile) + "\n...(이하 내용 생략)..."
        : content;
    contextTexts.push(`--- [참고 파일명: ${filename}] ---\n${truncated}\n`);
  }

  if (!contextTexts.length && scoredFiles.length) {
    const { filename, content } = scoredFiles[0];
    contextTexts.push(`--- [참고 파일명: ${filename} (전체 파일 중 일부)] ---\n${content.slice(0, 2000)}...\n`);
  }

  return contextTexts.join("\n");
}

// ==========================================
// ✅ 5. 과거 대화 참고 자료 구성
// ==========================================
function collectReferenceChats(chatsDict, selectedIds, currentChatId, maxMessagesPerChat = 5) {
  if (!selectedIds || !selectedIds.length) return "";

  const refParts = [];
  for (const chatId of selectedIds) {
    if (chatId === currentChatId) continue;
    const chat = chatsDict[chatId];
    if (!chat) continue;

    const title = chat.title || "제목 없음";
    const messages = chat.messages || [];
    const recentMessages = messages.slice(-maxMessagesPerChat);
    if (!recentMessages.length) continue;

    let chatContent = `\n--- [과거 대화: ${title}] ---\n`;
    for (const msg of recentMessages) {
      const roleKr = msg.role === "user" ? "사용자" : "AI";
      const text = extractText(msg.content);
      chatContent += `${roleKr}: ${text}\n`;
    }
    refParts.push(chatContent);
  }
  return refParts.join("\n");
}

// 메시지 content 에서 텍스트 부분만 추출 (문자열 또는 멀티모달 배열 대응)
function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((item) => item && item.type === "text")
      .map((item) => item.text)
      .join(" ");
  }
  return "";
}

// ==========================================
// 💾 6. Supabase DB 저장/불러오기
// ==========================================
async function loadUserChatsFromDB(supabase, userId) {
  const { data, error } = await supabase
    .from("user_chats")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function saveChatToDB(supabase, userId, chatId, title, messages) {
  const { error } = await supabase
    .from("user_chats")
    .upsert(
      {
        id: chatId,
        user_id: userId,
        title,
        messages,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  if (error) throw error;
}

// ==========================================
// 🚀 7. Express 앱
// ==========================================
const app = express();
app.use(express.json({ limit: "20mb" })); // base64 이미지 첨부 대응
app.use(express.static(path.join(__dirname, "public")));

// ---- 인증 API ----

// 로그인
app.post("/api/auth/login", async (req, res) => {
  const { userId, password } = req.body || {};
  if (!userId || !password) {
    return res.status(400).json({ error: "아이디와 비밀번호를 모두 입력해주세요." });
  }
  try {
    const { data, error } = await anonClient.auth.signInWithPassword({
      email: userIdToEmail(userId),
      password,
    });
    if (error) throw error;
    if (data && data.user && data.session) {
      setAuthCookies(res, data.session.access_token, data.session.refresh_token, userId);
      return res.json({
        user: { id: data.user.id, displayUserId: userId },
        message: "로그인 성공!",
      });
    }
    return res.status(401).json({ error: "로그인 실패: 아이디 또는 비밀번호가 올바르지 않습니다." });
  } catch (e) {
    const msg = String(e && e.message ? e.message : e).toLowerCase();
    if (msg.includes("rate limit")) {
      return res.status(429).json({ error: "⚠️ 로그인 시도가 너무 많습니다. 1시간 후 다시 시도해 주세요." });
    }
    if (msg.includes("invalid login credentials")) {
      return res.status(401).json({ error: "로그인 실패: 아이디 또는 비밀번호가 올바르지 않습니다." });
    }
    return res.status(500).json({ error: `로그인 오류: ${e.message || e}` });
  }
});

// 회원가입
app.post("/api/auth/signup", async (req, res) => {
  const { userId, password, confirmPassword } = req.body || {};
  if (!userId || !password || !confirmPassword) {
    return res.status(400).json({ error: "모든 필드를 입력해주세요." });
  }
  if (userId.length < 3) {
    return res.status(400).json({ error: "아이디는 3자 이상이어야 합니다." });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "비밀번호가 일치하지 않습니다." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "비밀번호는 6자 이상이어야 합니다." });
  }
  try {
    const email = userIdToEmail(userId);
    const { data, error } = await anonClient.auth.signUp({ email, password });
    if (error) throw error;

    // 이메일 확인 활성화 설정이면 session 이 없음 → 자동 로그인 시도 (Python 로직 동일)
    if (data && data.user && data.session) {
      setAuthCookies(res, data.session.access_token, data.session.refresh_token, userId);
      return res.json({
        user: { id: data.user.id, displayUserId: userId },
        message: `🎉 ${userId}님, 환영합니다! 자동으로 로그인되었습니다.`,
      });
    }
    if (data && data.user) {
      const login = await anonClient.auth.signInWithPassword({ email, password });
      if (login.data && login.data.user && login.data.session) {
        setAuthCookies(res, login.data.session.access_token, login.data.session.refresh_token, userId);
        return res.json({
          user: { id: login.data.user.id, displayUserId: userId },
          message: `🎉 ${userId}님, 환영합니다!`,
        });
      }
    }
    return res.status(400).json({ error: "회원가입은 완료되었으나 자동 로그인에 실패했습니다. 로그인해 주세요." });
  } catch (e) {
    const msg = String(e && e.message ? e.message : e).toLowerCase();
    if (msg.includes("rate limit")) {
      return res.status(429).json({ error: "⚠️ 회원가입 시도가 너무 많습니다. 1시간 후 다시 시도해 주세요." });
    }
    if (msg.includes("user already registered")) {
      return res.status(409).json({ error: "이미 등록된 아이디입니다. 로그인 탭에서 로그인해 주세요." });
    }
    return res.status(500).json({ error: `회원가입 실패: ${e.message || e}` });
  }
});

// 로그아웃
app.post("/api/auth/logout", async (req, res) => {
  const cookies = parseCookies(req);
  try {
    if (cookies.sb_access_token) await anonClient.auth.signOut(cookies.sb_access_token);
  } catch { /* 토큰이 이미 만료된 경우 무시 */ }
  clearAuthCookies(res);
  res.json({ ok: true });
});

// 로그인 상태 확인
app.get("/api/auth/me", async (req, res) => {
  const session = await resolveUser(req, res);
  if (!session) return res.json({ user: null });
  const cookies = parseCookies(req);
  res.json({
    user: {
      id: session.user.id,
      displayUserId: cookies.sb_user_id || emailToUserId(session.user.email),
    },
  });
});

// ---- 대화 목록 API (로그인 필요) ----
app.get("/api/chats", async (req, res) => {
  const session = await resolveUser(req, res);
  if (!session) return res.status(401).json({ error: "로그인이 필요합니다." });
  try {
    const supabase = clientForUser(session.accessToken);
    const rows = await loadUserChatsFromDB(supabase, session.user.id);
    res.json({
      chats: rows.map((row) => ({
        id: row.id,
        title: row.title,
        messages: row.messages || [],
        updatedAt: row.updated_at,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: `대화 목록 불러오기 실패: ${e.message || e}` });
  }
});

// ---- AI 채팅 (SSE 스트리밍) ----
app.post("/api/chat/send", async (req, res) => {
  const session = await resolveUser(req, res);
  const { chatId, title, messages, refChatIds } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "메시지가 비어 있습니다." });
  }
  if (!NVIDIA_API_KEY) {
    return res.status(500).json({ error: "⚠️ NVIDIA_API_KEY가 설정되지 않았습니다." });
  }

  // 사용자 메시지 먼저 DB 저장 (Python 과 동일 순서)
  let supabase = null;
  if (session) {
    try {
      supabase = clientForUser(session.accessToken);
      await saveChatToDB(supabase, session.user.id, chatId, title || "새로운 대화", messages);
    } catch (e) {
      console.error("대화 저장 실패:", e.message);
    }
  }

  // SSE 헤더
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const sse = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    // 마지막 사용자 질문 텍스트 → RAG
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const promptText = lastUserMsg ? extractText(lastUserMsg.content) : "";

    const dataContext = loadRelevantData(promptText);

    let refContext = "";
    if (session && Array.isArray(refChatIds) && refChatIds.length) {
      try {
        const rows = await loadUserChatsFromDB(supabase, session.user.id);
        const chatsDict = {};
        for (const row of rows) chatsDict[row.id] = { title: row.title, messages: row.messages || [] };
        refContext = collectReferenceChats(chatsDict, refChatIds, chatId);
      } catch (e) {
        console.error("과거 대화 참고 로드 실패:", e.message);
      }
    }

    let systemPrompt = BASE_SYSTEM_PROMPT;
    if (dataContext) systemPrompt += `\n\n[참고 자료]\n${dataContext}`;
    if (refContext) systemPrompt += `\n\n[과거 대화 참고 자료]\n${refContext}`;

    // 최근 10개 메시지만 전송 (Python max_history_messages = 10)
    const recentMessages = messages.slice(-10);
    const messagesToSend = [{ role: "system", content: systemPrompt }, ...recentMessages];

    const client = new OpenAI({
      baseURL: AI_BASE_URL,
      apiKey: NVIDIA_API_KEY,
      timeout: AI_TIMEOUT_MS,
    });

    const stream = await client.chat.completions.create({
      model: AI_MODEL,
      messages: messagesToSend,
      stream: true,
    });

    let full = "";
    for await (const chunk of stream) {
      const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta
        ? chunk.choices[0].delta.content || ""
        : "";
      if (delta) {
        full += delta;
        sse({ type: "delta", delta });
      }
    }

    // AI 응답 저장
    if (session && supabase) {
      try {
        const savedMessages = [...messages, { role: "assistant", content: full }];
        await saveChatToDB(supabase, session.user.id, chatId, title || "새로운 대화", savedMessages);
      } catch (e) {
        console.error("AI 응답 저장 실패:", e.message);
      }
    }

    sse({ type: "done", content: full });
  } catch (e) {
    const isTimeout =
      e &&
      (e.code === "ETIMEDOUT" ||
       e.code === "ETIMEOUT" ||
       String(e.name || "").toLowerCase().includes("timeout") ||
       (e.constructor && String(e.constructor.name).includes("Timeout")));
    if (isTimeout) {
      sse({
        type: "error",
        error: "⏱️ **요청 시간 초과**: AI 서버 응답이 느리거나 전송된 데이터 양이 너무 많습니다. 질문을 더 간결하게 하거나, '과거 대화 참고' 선택을 줄여주세요.",
      });
    } else {
      sse({ type: "error", error: `오류가 발생했습니다: ${e.message || e}` });
    }
  } finally {
    res.end();
  }
});

// ---- 시작 ----
if (!NVIDIA_API_KEY) {
  console.warn("⚠️ NVIDIA_API_KEY가 설정되지 않았습니다. AI 답변 기능을 사용할 수 없습니다.");
}

app.listen(PORT, () => {
  console.log(`⚡ 나만의 AI 전기설비 도우미 (Node.js) 실행 중: http://localhost:${PORT}`);
  console.log(`📂 RAG 참고 자료 폴더: ${DATA_DIR}`);
});
