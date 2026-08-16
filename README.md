# Story Vault

이야기를 안전하게 보관한다는 의미.

웹소설 장기 연재를 위한 파일 기반 집필 저장소다.
거대한 단일 프롬프트 대신 **불변 규칙 / 정사 데이터 / 현재 상태 / 회차 원고**를
파일로 분리해, 회차가 쌓여도 설정 붕괴와 연속성 오류가 누적되지 않게 한다.

## 구조

```text
Story Vault/
├─ AGENTS.md              집필·편집의 절대 규칙 (집필 엔진)
├─ PLATFORM.md            대상 플랫폼과 분량·연재 기준
├─ CLAUDE.md              Claude Code용 프로젝트 지침
│
├─ canon/                 정사 데이터 (객관적 사실)
│  ├─ world.md
│  ├─ characters.md
│  └─ terminology.md
│
├─ plot/                  플롯 설계 (미래 정보 포함)
│  ├─ master_plot.md
│  ├─ current_arc.md
│  └─ foreshadowing.md
│
├─ state/                 현재 확정 상태
│  └─ continuity.md
│
├─ episodes/
│  ├─ published/          공개된 정본 (지시 없이 수정 금지)
│  └─ drafts/             미공개 초고
│
├─ analytics/             독자 반응·회차 성과 (정사보다 우선하지 않음)
│  ├─ reader_feedback.md
│  └─ episode_metrics.md
│
├─ prompts/
│  └─ COMMANDS.md         회차 작성·검수 명령 템플릿
│
├─ archive/               폐기된 설정 (되살리지 않음)
│  └─ deprecated_settings.md
│
└─ docs/research/         근거 리서치 원문
   ├─ novelpia-codex-research.md
   └─ joara-codex-research.md
```

## 시작하기

1. `PLATFORM.md`에서 **대상 플랫폼을 먼저 지정한다.**
   노벨피아는 글자 수, 조아라는 KB 용량으로 기준이 다르다.
2. `canon/world.md`, `canon/characters.md`를 채운다.
3. `plot/master_plot.md`로 결말과 전체 아크를 먼저 정한다.
4. `plot/current_arc.md`에 당장 쓸 아크를 잡는다.
5. `prompts/COMMANDS.md`의 템플릿으로 회차를 작성한다.

## 운영 원칙

- **회차 입력에 과거 원고 전체를 넣지 않는다.** 정사 + 직전 3화 + 이번 화 목표만 넣는다.
- **초고 단계에서 설정을 확정하지 않는다.** 승인 후에만 `state/continuity.md`를 갱신한다.
- **공개된 원고를 몰래 고치지 않는다.** 설정 문서와 충돌하면 먼저 보고한다.
- **10~20화마다 정기 감사**를 실시한다. (모순·미회수 복선·말투 드리프트)

상세 규칙은 `AGENTS.md`에 있다.

## 참고

`tauri_src/`는 참고용 Tauri 프레임워크 업스트림 클론이며 이 저장소의 소스가 아니다.
버전 관리에서 제외되어 있다.
