// 원본 Python(app.py)과 동일한 상수값
export const AI_AVATAR_URL =
  "https://cdn.phototourl.com/free/2026-07-23-15287eb1-a0dc-42f5-895b-ba283e857248.png";
export const SIDEBAR_HEADER_IMAGE =
  "https://cdn.phototourl.com/free/2026-07-23-b00d3b3d-b411-4d1e-a452-24355967b5ce.png";

export const AI_BASE_URL = import.meta.env.VITE_AI_BASE_URL || "https://ollama.com/v1";
export const AI_MODEL = import.meta.env.VITE_AI_MODEL || "gemma4:31b-cloud";
export const AI_TIMEOUT_MS = 120_000;

// 최근 10개 메시지만 히스토리로 전송
export const MAX_HISTORY_MESSAGES = 10;
// 과거 대화 참고: 최대 3개, 대화당 최근 5개 메시지
export const REF_MAX_CHATS = 3;
export const REF_MESSAGES_PER_CHAT = 5;
// RAG: 관련 파일 상위 2개, 파일당 2000자
export const RAG_MAX_FILES = 2;
export const RAG_MAX_CHARS = 2000;

export const BASE_SYSTEM_PROMPT = `너는 전기설비 분야의 친절하고 전문적인 AI 도우미야.
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
