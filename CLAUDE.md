Story Vault — 이야기를 안전하게 보관한다는 의미

이 저장소는 **두 가지**를 담고 있다.

1. **앱** — Tauri v2 + React 데스크톱 집필 도구 (`src/`, `src-tauri/`)
2. **집필 저장소** — 원고와 설정 (`vault/`)

작업 요청이 어느 쪽인지 먼저 구분한다. 앱 개발과 소설 집필은 규칙이 다르다.

---

# 소설 집필 작업

## 집필 규칙은 vault/AGENTS.md를 따른다

**소설 집필·수정·검수 작업을 하기 전에 반드시 `vault/AGENTS.md`를 읽고 그 규칙을 그대로 적용한다.**
집필의 절대 규칙(정사 우선순위, 정보 비대칭, POV, 문체, 회차 구조, 완료 조건)은 전부 거기에 있다.
CLAUDE.md에 중복해 적지 않는다.

분량·연재 기준은 `vault/PLATFORM.md`에 있다. **대상 플랫폼이 미설정이면 회차를 쓰기 전에 사용자에게 먼저 묻는다.**
노벨피아는 글자 수, 조아라는 KB 용량으로 산정 단위 자체가 다르므로 추정하지 않는다.

## 필독 레퍼런스

위 규칙의 근거 원문이다. 규칙의 배경이나 수치의 출처가 필요할 때 읽는다.

- `docs/research/novelpia-codex-research.md` — 노벨피아 연재 기준 Codex 소설 프롬프트 최적화 리서치
- `docs/research/joara-codex-research.md` — 조아라 연재 기준 Codex 웹소설 집필 시스템 리서치

플랫폼 기준 요약:

| 항목 | 노벨피아 | 조아라 |
|---|---|---|
| 산정 단위 | 글자 수 (공백 미포함) | KB 용량 |
| 회차 기준 | 3,000자 이상 | 회차 10KB 이상 / 평균 12KB 이상 |
| 실무 권장 | 3,300~4,200자 | 10~12KB |
| 편수 조건 | 프롤로그 제외 15화 이상 | 프리미엄 20편 이상 |

노벨피아는 띄어쓰기 외에 마침표·따옴표·개행·탭·느낌표·물음표도 글자 수에서 제외한다.
일반 워드프로세서 집계보다 적게 나오므로 기준선에 아슬아슬하게 맞추지 않는다.

## 파일 취급 규칙

- `vault/episodes/published/` — 공개된 정본. **명시적 지시 없이 수정하지 않는다.**
- `vault/state/continuity.md` — 회차가 승인되어 published로 확정될 때만 갱신한다. 초고 단계에서 갱신하지 않는다.
- `vault/canon/`, `vault/plot/` — 설정을 임의로 새로 확정하지 않는다. 필요하면 사용자에게 확인한다.
- `vault/archive/` — 폐기된 설정. 참조만 하고 되살리지 않는다.

## 자주 쓰는 명령

회차 작성·검수·감사 명령 템플릿은 `vault/prompts/COMMANDS.md`에 있다.

---

# 앱 개발 작업

Tauri v2 + React + TypeScript. 프론트는 `src/`, Rust 백엔드는 `src-tauri/`.

```bash
npm run tauri dev     # 개발 실행
npm test              # vitest
npm run tauri build   # 릴리스 빌드
```

## 주의 사항

- **`src/lib/count.ts` 는 이 앱의 핵심이다.** 플랫폼별 분량 계산 규칙이 들어 있고,
  틀리면 작가가 기준 미달로 회차를 올리게 된다. 수정하면 반드시 테스트를 함께 고친다.
- 노벨피아 글자 수 규칙은 공식 목록이 완전히 공개되어 있지 않다.
  계산 결과를 확정값처럼 표시하지 않는다 — UI는 추정치임을 밝혀야 한다.
- 조아라 KB는 EUC-KR 바이트 기준이다. UTF-8로 계산하면 1.5배가 되어 완전히 틀린다.
- `src-tauri/src/lib.rs` 의 `resolve()` 는 vault 루트 밖 경로 접근을 막는다. 우회하지 않는다.
- `tauri_src/` — 참고용 Tauri 업스트림 클론. **이 저장소의 소스가 아니며 수정하지 않는다.** (`.gitignore` 처리됨)
- `.secrets/` — 업데이터 서명 개인키. **절대 커밋하지 않는다.**

## 릴리스

`main` 에 앱 소스가 바뀌면 `.github/workflows/release.yml` 이 빌드해 릴리스를 발행한다.
버전은 `github.run_number` 로 자동 증가한다.
`vault/`, `docs/`, `*.md` 만 바뀐 커밋은 빌드하지 않는다.

## 플랫폼 업로드 자동화

현황과 선택지는 `docs/upload-automation.md` 참조. **아직 구현하지 않았다.**
두 플랫폼 모두 공개 API가 없어 비공개 엔드포인트 역분석이 필요하고,
약관·계정 정지 위험이 있어 방식 결정이 선행되어야 한다.

---

# git

원격은 `https://mistFlower@github.com/mistFlower/Story-Vault.git` 이다.
이 PC에는 다른 GitHub 계정(`the-last-sky`)의 자격 증명도 저장되어 있어,
원격 URL에서 `mistFlower@` 를 제거하면 403이 발생한다. 제거하지 않는다.
