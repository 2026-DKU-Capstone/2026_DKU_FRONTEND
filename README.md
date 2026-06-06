# 가결 — Frontend

> 단국대학교 학생 단체를 위한 예산 결재·관리 웹 서비스

## 기술 스택

| 분류 | 기술 |
|------|------|
| Framework | Next.js 16.2.4 (App Router) |
| Language | TypeScript 5 |
| Runtime | React 19 |
| Styling | CSS-in-JS (인라인 스타일) |
| 인증 | JWT Bearer Token |

## 시작하기

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp .env.example .env.local
# .env.local 열어서 NEXT_PUBLIC_API_URL 값 입력

# 3. 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

## 환경 변수

`.env.local` 파일을 루트에 생성하고 아래 값을 입력합니다.

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `NEXT_PUBLIC_API_URL` | 백엔드 API 서버 주소 | `https://3.26.0.223.nip.io` |

## 주요 기능

- **대시보드** — 월별 제출 현황, 진행 중 결재 수, 규정 준수율 요약
- **AI 양식 추천** — 목적에 맞는 양식을 AI가 자동 추천
- **양식 작성** — 다양한 학생 단체 양식 작성 및 제출
- **서류 검토** — 학생증 등 첨부 서류 업로드 및 검토
- **규정 준수 확인** — 작성한 양식의 규정 준수 여부 자동 검사
- **결재 관리** — 결재 요청 목록 조회 및 승인/반려 처리
- **수입지출관리대장** — 수입·지출 내역 입력 및 PDF 출력
- **영수증 업로드** — 지출 증빙 영수증 이미지 첨부
- **그룹 관리** — 단체 멤버 역할(소유자/관리자/일반) 설정

## 프로젝트 구조

```
app/
├── landing/           # 랜딩 페이지
├── login/             # 로그인
├── group-select/      # 그룹 선택
└── (app)/             # 인증 필요 영역
    ├── dashboard/
    ├── form-select/   # 양식 선택
    ├── form-recommend/# AI 양식 추천
    ├── forms/         # 양식 작성
    ├── doc-review/    # 서류 검토
    ├── compliance/    # 규정 준수 확인
    ├── upload/        # 파일 업로드
    ├── receipt/       # 영수증
    ├── pdf/           # PDF 미리보기
    ├── approvals/     # 결재 목록
    ├── expense-board/ # 수입지출관리대장
    ├── group-settings/# 그룹 설정
    └── regulation/    # 규정 조회
components/
├── ui/                # 기본 UI 컴포넌트 (Btn, Input, Card 등)
├── AppNav.tsx         # 앱 내비게이션 바
├── FinalCheckOverlay.tsx
└── ...
screens/               # 페이지별 화면 컴포넌트
lib/
├── api.ts             # API fetch 래퍼 (JWT 자동 첨부)
├── auth.ts            # 토큰 관리
└── group.ts           # 그룹 ID 관리
```

## 스크립트

```bash
npm run dev    # 개발 서버 (localhost:3000)
npm run build  # 프로덕션 빌드
npm run start  # 프로덕션 서버 실행
npm run lint   # ESLint 검사
```

## 관련 레포지토리

- **Backend**: [2026-DKU-Capstone/GAGYEOL_BACKEND](https://github.com/2026-DKU-Capstone/GAGYEOL_BACKEND)

## 팀원

| 이름 | 역할 | GitHub |
|------|------|--------|
| 박세현 | 팀장 | [@parksehyn](https://github.com/parksehyn) |
| 안균승 | 팀원 | [@LOK-AeGS](https://github.com/LOK-AeGS) |
| 고동민 | 팀원 | [@kodongmin](https://github.com/kodongmin) |
| 김아름 | 팀원 | [@karuem](https://github.com/karuem) |
