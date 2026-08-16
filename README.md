# Story Vault

이야기를 안전하게 보관한다는 의미.

웹소설 장기 연재를 위한 데스크톱 집필 도구와, 그 원고 저장소다.

거대한 단일 프롬프트 대신 **불변 규칙 / 정사 데이터 / 현재 상태 / 회차 원고**를
파일로 분리해, 회차가 쌓여도 설정 붕괴와 연속성 오류가 누적되지 않게 한다.

## 앱

Tauri v2 + React 데스크톱 앱.

- vault 파일 트리 탐색과 마크다운 편집
- **플랫폼별 실시간 분량 게이지** — 노벨피아 글자 수와 조아라 KB를 동시에 표시
- main 브랜치 커밋 시 자동 빌드·배포, 앱은 실행 시 자동 업데이트

두 플랫폼은 산정 단위가 다르다. 노벨피아는 공백 외에 마침표·따옴표·느낌표·물음표까지
제외한 글자 수를, 조아라는 KB 용량을 쓴다. 같은 원고가 한쪽만 충족할 수 있어
둘을 나란히 보여준다.

### 개발

```bash
npm install
npm run tauri dev     # 개발 실행
npm test              # 분량 계산 로직 테스트
npm run tauri build   # 릴리스 빌드
```

요구사항: Node 22+, Rust 1.77+, Windows에서는 MSVC 빌드 도구와 WebView2.

## 저장소 구조

```text
Story-Vault/
├─ src/                   앱 프론트엔드 (React + TS)
│  ├─ lib/count.ts         플랫폼별 분량 계산 ← 핵심 로직
│  ├─ lib/publish.ts       게시 준비·검증
│  └─ components/
├─ src-tauri/             앱 백엔드 (Rust)
├─ .github/workflows/     릴리스 자동화
│
├─ vault/                 ← 집필 저장소
│  ├─ AGENTS.md            집필·편집 절대 규칙 (집필 엔진)
│  ├─ PLATFORM.md          대상 플랫폼과 분량 기준
│  ├─ canon/               world / characters / terminology
│  ├─ plot/                master_plot / current_arc / foreshadowing
│  ├─ state/continuity.md  현재 확정 상태
│  ├─ episodes/            published(정본) / drafts(초고)
│  ├─ analytics/           독자 반응·회차 성과
│  ├─ prompts/COMMANDS.md  회차 작성·검수 명령 템플릿
│  └─ archive/             폐기된 설정
│
└─ docs/
   ├─ upload-automation.md 플랫폼 업로드 자동화 현황
   └─ research/            근거 리서치 원문
```

## 집필 시작하기

1. `vault/PLATFORM.md`에서 **대상 플랫폼을 먼저 지정한다.**
2. `vault/canon/world.md`, `characters.md`를 채운다.
3. `vault/plot/master_plot.md`로 결말과 전체 아크를 먼저 정한다.
4. `vault/prompts/COMMANDS.md`의 템플릿으로 회차를 작성한다.

### 운영 원칙

- **회차 입력에 과거 원고 전체를 넣지 않는다.** 정사 + 직전 3화 + 이번 화 목표만.
- **초고 단계에서 설정을 확정하지 않는다.** 승인 후에만 `state/continuity.md`를 갱신.
- **공개된 원고를 몰래 고치지 않는다.** 설정 문서와 충돌하면 먼저 보고.
- **10~20화마다 정기 감사** — 모순, 미회수 복선, 말투 드리프트.

상세 규칙은 `vault/AGENTS.md`에 있다.

## 릴리스

`main`에 앱 소스가 바뀌면 GitHub Actions가 빌드해 릴리스를 발행하고,
실행 중인 앱이 다음 실행 시 자동으로 업데이트된다.
`vault/`와 `docs/`만 바뀐 커밋은 빌드하지 않는다 — 원고 작성이 릴리스를 만들면 곤란하다.

## 참고

`tauri_src/`는 참고용 Tauri 프레임워크 업스트림 클론이며 이 저장소의 소스가 아니다.
버전 관리에서 제외되어 있다.
