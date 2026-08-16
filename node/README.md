# ⚡ 나만의 AI 전기설비 도우미 — Node.js 버전

루트의 Python/Streamlit 앱(`app.py`)을 **Node.js(Express) + 바닐라 JS 프론트엔드**로 포팅한 버전입니다.
기능은 원본과 동일합니다.

## 기능

- 🔐 **Supabase 인증** — 아이디/비밀번호 회원가입·로그인 (내부적으로 `{아이디}@myapp.local` 이메일 변환), httpOnly 쿠키 세션 유지 + 자동 토큰 갱신
- 💬 **멀티 채팅** — 대화 생성/선택, 로그인 시 Supabase `user_chats` 테이블에 영구 저장, 게스트는 브라우저 세션에만 저장
- 📚 **RAG 참고 자료** — `data/` 폴더의 규정 txt 파일 중 질문과 관련도 높은 상위 2개(파일당 2000자)를 시스템 프롬프트에 포함
- 📖 **과거 대화 참고** — 로그인 사용자는 과거 대화 최대 3개를 선택해 AI가 참고하도록 전달 (각 대화 최근 5개 메시지)
- 🖼️ **이미지 멀티모달** — PNG/JPG/JPEG/WEBP 업로드 후 질문과 함께 비전 모델로 분석
- 🌊 **스트리밍 답변** — SSE(Server-Sent Events)로 실시간 출력
- 📁 **대화 백업** — 현재 대화 JSON 내보내기 / 불러오기

## 실행 방법

```bash
cd node
npm install
cp .env.example .env   # 값을 채워 넣으세요
npm start              # 기본 포트 3000 → http://localhost:3000
```

`.env` 필수 값:

| 변수 | 설명 |
|---|---|
| `NVIDIA_API_KEY` | ollama.com(v1 호환) API 키 — 원본과 동일한 `https://ollama.com/v1` / `gemma4:31b-cloud` 모델 사용 |
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |

선택 값: `PORT`(기본 3000), `DATA_DIR`(기본: `node/data` 가 있으면 사용, 없으면 상위 `../data`)

## 참고 자료 폴더 (RAG)

Python 원본과 동일하게 `data/` 안의 `.txt` `.md` `.json` `.csv` 파일(하위 폴더 제외)을 읽습니다.
별도 배포 시 `node/data/` 폴더를 만들거나 `DATA_DIR`로 경로를 지정하세요.

## Supabase 테이블 스키마 (`user_chats`)

원본 Python 앱과 같은 테이블을 그대로 사용합니다 (두 버전 간 데이터 호환).

```sql
create table user_chats (
  id uuid primary key,
  user_id uuid not null,
  title text,
  messages jsonb default '[]',
  updated_at timestamptz default now()
);
```

## Python 버전과의 차이점

| 항목 | Python (Streamlit) | Node.js |
|---|---|---|
| UI | Streamlit 서버 렌더링 | Express 정적 파일 + 바닐라 JS SPA |
| 세션/쿠키 | streamlit-cookies-controller | httpOnly 쿠키 (서버 관리) |
| 스트리밍 | `st.write_stream` | SSE (`text/event-stream`) |
| 게스트 대화 저장 | 서버 세션 메모리 | 브라우저 sessionStorage |
| 마크다운 | st.markdown | marked + DOMPurify |

시스템 프롬프트, RAG 선별 로직(키워드 점수 상위 2개·2000자), 최근 10개 메시지 히스토리, 과거 대화 참고 5개 제한 등
AI 동작 관련 로직은 원본과 완전히 동일하게 포팅되었습니다.
