/**
 * 플랫폼에서 가져온 작품 정보를 vault 파일에 기록한다.
 *
 * Codex 에 데이터를 직접 밀어넣지 않는다. vault 파일에 써두면 Codex 가
 * AGENTS.md 규칙에 따라 읽어간다 — 리서치 문서가 권장하는 방식이다.
 *
 * 조회 계층(플랫폼에서 실제로 긁어오는 부분)은 아직 없다.
 * 이 파일은 데이터가 들어왔을 때 "어디에 어떻게 쓸지"만 담당한다.
 */

import type { Platform } from './count'
import { PLATFORM_LABEL } from './platform'

/** 플랫폼에서 읽어온 작품 한 편. */
export interface Work {
  /** 플랫폼 내부 작품 ID */
  id: string
  title: string
  platform: Platform
  /** 작품 소개 페이지 주소 */
  url?: string
  genre?: string
  tags?: string[]
  /** 연재 상태 (연재중/완결/휴재 등) */
  status?: string
  episodeCount?: number
  /** 마지막 연재일 (ISO) */
  lastPublishedAt?: string
}

/** 회차 한 편의 플랫폼 지표. */
export interface EpisodeMetric {
  number: number
  title: string
  publishedAt?: string
  /** 노벨피아는 글자 수, 조아라는 KB — 플랫폼이 표시하는 값 그대로 */
  size?: string
  views?: number
  likes?: number
  comments?: number
}

// ── 마크다운 생성 ──────────────────────────────────────────

const NA = '—'

function cell(v: unknown): string {
  if (v === undefined || v === null || v === '') return NA
  // 표가 깨지지 않게 파이프를 이스케이프한다.
  return String(v).replace(/\|/g, '\\|')
}

function num(v: number | undefined): string {
  return v === undefined ? NA : v.toLocaleString('ko-KR')
}

/**
 * 연결된 작품 정보를 마크다운으로 만든다.
 * `vault/analytics/connected_work.md` 에 저장한다.
 */
export function renderWork(work: Work, fetchedAt: string): string {
  return `# CONNECTED WORK

> 이 파일은 앱이 플랫폼에서 읽어와 자동 생성한다. **직접 수정하지 않는다.**
> 다시 연결하면 덮어쓰인다.

플랫폼: ${PLATFORM_LABEL[work.platform]}
작품명: ${work.title}
작품 ID: ${work.id}
${work.url ? `주소: ${work.url}` : ''}
장르: ${cell(work.genre)}
연재 상태: ${cell(work.status)}
공개 회차: ${num(work.episodeCount)}
최근 연재일: ${cell(work.lastPublishedAt)}
읽어온 시각: ${fetchedAt}

## 태그

${work.tags?.length ? work.tags.map((t) => `- ${t}`).join('\n') : '- (없음)'}

## 주의

여기 적힌 것은 **플랫폼에 실제로 공개된 상태**다.
canon/ 과 충돌하면 이쪽이 사실이다 — AGENTS.md 의 사실 우선순위에서
published 회차가 설정 문서보다 우선하기 때문이다.

충돌을 발견하면 원고를 고치지 말고 먼저 보고한다.
`
}

/**
 * 회차 지표 표를 마크다운으로 만든다.
 * `vault/analytics/episode_metrics.md` 에 저장한다.
 */
export function renderMetrics(
  platform: Platform,
  episodes: EpisodeMetric[],
  fetchedAt: string,
): string {
  const unit = platform === 'novelpia' ? '글자 수' : '용량'

  const rows = episodes
    .map(
      (e) =>
        `| ${e.number} | ${cell(e.title)} | ${cell(e.publishedAt)} | ${cell(e.size)} | ` +
        `${num(e.views)} | ${num(e.likes)} | ${num(e.comments)} |`,
    )
    .join('\n')

  return `# EPISODE METRICS

> 이 파일은 앱이 플랫폼에서 읽어와 자동 생성한다. **직접 수정하지 않는다.**

플랫폼: ${PLATFORM_LABEL[platform]}
읽어온 시각: ${fetchedAt}
회차 수: ${episodes.length}

| 회차 | 제목 | 공개일 | ${unit} | 조회 | 선호 | 댓글 |
|---:|---|---|---:|---:|---:|---:|
${rows || `| ${NA} | ${NA} | ${NA} | ${NA} | ${NA} | ${NA} | ${NA} |`}

## 주의

표본이 적을 때의 조회 수 차이를 인과로 해석하지 않는다.
같은 신호가 3회 이상 반복될 때만 집필 규칙에 반영한다.

독자 반응 해석은 analytics/reader_feedback.md 에 사람이 적는다.
이 파일은 숫자만 담는다.
`
}

/**
 * PLATFORM.md 의 작품 메타 줄을 갱신한다.
 * 대상 플랫폼 줄은 platform.ts 가 따로 다룬다.
 */
export function applyWorkMeta(markdown: string, work: Work): string {
  const set = (src: string, key: string, value: string) => {
    const re = new RegExp(`^${key}:.*$`, 'm')
    const line = `${key}: ${value}`
    return re.test(src) ? src.replace(re, line) : src
  }

  let out = markdown
  out = set(out, '작품명', work.title)
  if (work.episodeCount !== undefined) {
    out = set(out, '현재 공개 회차', String(work.episodeCount))
  }
  return out
}

/** 앱이 자동 생성하는 파일 경로. vault 루트 기준 상대 경로. */
export const GENERATED = {
  work: 'analytics/connected_work.md',
  metrics: 'analytics/episode_metrics.md',
  platform: 'PLATFORM.md',
} as const
