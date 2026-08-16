# ⚡ Electrical Installation Helper (나만의 AI 전기설비 도우미)

**Electrical Installation Helper**는 전기기능사 필기 3과목 및 전기(공사)기사·전기(공사)산업기사 필기 5과목을 공부하는 학생을 위한 AI 챗봇입니다. 2026년 1월 기준 최신 KEC 규정 데이터를 참고해 답변합니다.

> 원본 Python/Streamlit 버전은 [`python/`](./python) 폴더에 보존되어 있습니다.
> 두 버전은 동일한 Supabase `user_chats` 테이블을 사용하므로 대화 데이터가 호환됩니다.

## 🚀 시작하기

```bash
# npm 사용 시
npm install
cp .env.example .env   # 값을 채워 넣으세요
npm run dev            # http://localhost:8080

# bun 사용 시
bun install
bun run dev
```

### 환경변수 (`.env`)

| 변수 | 설명 |
|---|---|
| `VITE_NVIDIA_API_KEY` | AI API 키 (ollama.com v1 호환 엔드포인트) |
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_AI_BASE_URL` | (선택) 기본값 `https://ollama.com/v1` |
| `VITE_AI_MODEL` | (선택) 기본값 `gemma4:31b-cloud` |

> ⚠️ **보안 주의**: `VITE_` 변수는 브라우저 번들에 포함되어 외부에 노출될 수 있습니다.
> 공개 서비스로 배포할 때는 AI 키를 서버/엣지 함수(예: Supabase Edge Functions)로 분리하는 것을 권장합니다.
> 또한 브라우저에서 직접 AI API를 호출할 때 CORS 정책에 따라 프록시가 필요할 수 있습니다 — 그 경우 `VITE_AI_BASE_URL`을 프록시 주소로 지정하세요.

### Supabase 테이블 스키마 (`user_chats`)

```sql
create table user_chats (
  id uuid primary key,
  user_id uuid not null,
  title text,
  messages jsonb default '[]',
  updated_at timestamptz default now()
);
```

## 📁 프로젝트 구조

```
.lovable/            Lovable 스타일 구성 마커
public/              정적 에셋 (favicon)
src/
  components/        UI 컴포넌트 (사이드바, 채팅, 인증 폼)
  components/ui/     shadcn/ui 기본 컴포넌트
  hooks/             useAuth, useChatStore
  lib/               RAG, AI 스트리밍, 백업, Supabase 클라이언트, 상수
  pages/             페이지 (Index)
data/                KEC 규정 텍스트 파일 202개 (RAG용, 빌드 시 번들 포함)
python/              원본 Python/Streamlit 버전
```

## ✨ 주요 기능

- **최신 개정 규정 안내** — 2026년 1월 개정 KEC 규정 기준, 질문과 관련도 높은 규정 파일 상위 2개를 자동 선별(파일당 2,000자)해 참고합니다.
- **4지선다 문제 출제** — "문제를 만들어 줘" 요청에 1~4 선택지 형식으로 출제.
- **이미지 문제 해설** — 배선도/기기 사진/문제 이미지 업로드 후 질문하면 비전 모델이 분석합니다.
- **계정별 대화 저장** — Supabase 인증(아이디/비밀번호)으로 대화 영구 저장. 게스트도 사용 가능(브라우저 세션에만 저장).
- **과거 대화 참고** — 이전 대화 최대 3개를 선택하면 AI가 맥락을 참고해 답변.
- **대화 백업** — 현재 대화를 JSON으로 내보내기/불러오기.
- **스트리밍 답변** — 답변이 실시간으로 출력됩니다.

## 🔧 기술 스택

- React 18 + TypeScript + Vite
- Tailwind CSS v4 + shadcn/ui 스타일 컴포넌트
- Supabase (인증 + DB, RLS)
- OpenAI 호환 API (스트리밍)

## 라이선스

MIT License — 본 프로젝트는 NAVER OGQ 공모전 출품을 목적으로 제작되었습니다.

## AI 사용 내역

- **서비스 모델**: gemma-4-31b-it (텍스트/이미지 입력 분석)
- **개발 지원**: gemini-3.5-flash, qwen-3.7-plus, deepseek-v4-flash
- **이미지 생성**: Nano Banana 2, GPT Image 2
- **에이전트**: Antigravity, ChatGPT Codex
