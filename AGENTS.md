# Lovable Project Instructions (전기설비 도우미)

이 저장소는 Lovable 스타일 구성(Vite + React + TypeScript + Tailwind CSS + shadcn/ui)을 따르며,
원본 Python/Streamlit 앱(`python/app.py`)을 이 구조로 포팅한 프로젝트입니다.

## Project Structure

- `src/main.tsx` — 엔트리 포인트
- `src/App.tsx` — 라우팅 (react-router-dom)
- `src/pages/Index.tsx` — 메인 페이지 (채팅 화면 전체 레이아웃)
- `src/components/` — 기능 컴포넌트 (Sidebar, AuthPanel, ChatMessage, ChatInput)
- `src/components/ui/` — shadcn/ui 스타일 기본 컴포넌트
- `src/hooks/` — `useAuth`(Supabase 인증), `useChatStore`(대화 상태 관리)
- `src/lib/` — 순수 로직 (RAG, AI 스트리밍, 백업, Supabase 클라이언트, 상수)
- `data/` — KEC 규정 텍스트 파일 202개 (빌드 타임에 번들에 포함됨)
- `python/` — 원본 Python/Streamlit 버전 (레거시)

## Development Rules

- **컴포넌트는 함수형 컴포넌트 + TypeScript** 로 작성합니다.
- 스타일은 **Tailwind CSS 유틸리티 클래스**만 사용하고, 커스텀 CSS는 `src/index.css`의
  `.markdown-body`처럼 불가피한 경우에만 추가합니다.
- shadcn/ui 컴포넌트 추가 시 `components.json`의 alias(`@/components`, `@/lib`) 규칙을 따릅니다.
- 경로는 `@/` 별칭(`src/`)을 사용합니다.
- AI 동작 관련 상수(시스템 프롬프트, 히스토리 10개, RAG 상위 2파일×2000자 등)는
  `src/lib/constants.ts`와 `src/lib/rag.ts`에 있으며, 원본 Python 앱과의 일치성을 유지해야 합니다.
- Supabase 테이블 스키마(`user_chats`)는 Python 버전과 공유하므로 함부로 변경하지 않습니다.

## Commands

- `npm run dev` / `bun run dev` — 개발 서버 (http://localhost:8080)
- `npm run build` — 타입 검사(tsc) + 프로덕션 빌드
- `npm run lint` — ESLint 검사
- `npm run format` — Prettier 포맷팅

## Environment

루트 `.env`(또는 `.env.local`)에 `VITE_` 접두어 환경변수가 필요합니다 — `.env.example` 참고.
`VITE_` 변수는 클라이언트에 노출되므로 공개 배포 시 AI 키 프록시 분리를 권장합니다.
