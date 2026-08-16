/**
 * 플랫폼 게시 어댑터.
 *
 * 지금은 "반자동" 어댑터만 구현되어 있다 — 원고를 플랫폼 형식으로 변환하고
 * 검증까지 해주되, 실제 게시는 사용자가 직접 한다.
 *
 * 자동 로그인·자동 업로드는 두 플랫폼 모두 공개 API가 없어 비공개 엔드포인트를
 * 역분석해야 하고, 약관과 계정 정지 위험이 걸려 있다.
 * 배경과 선택지는 docs/upload-automation.md 참조.
 */

import { countAll, judge, THRESHOLDS, type Platform } from './count'

export interface PreparedEpisode {
  platform: Platform
  title: string
  /** 플랫폼 편집기에 붙여넣을 본문 */
  body: string
  /** 게시 전에 사람이 확인해야 하는 항목 */
  warnings: string[]
  /** 게시를 막아야 하는 문제 */
  blockers: string[]
}

/** 마크다운 원고를 플랫폼 편집기용 평문으로 변환한다. */
export function toPlainText(markdown: string): string {
  return markdown
    // 제목 줄은 본문에 넣지 않는다.
    .replace(/^#{1,6}\s+.*$/gm, '')
    // 강조 기호 제거 — 플랫폼 편집기는 마크다운을 해석하지 않는다.
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    // 주석 제거
    .replace(/<!--[\s\S]*?-->/g, '')
    // 수평선을 장면 전환 구분으로
    .replace(/^---+$/gm, '')
    // 3줄 이상 연속 개행을 2줄로
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 제목을 뽑는다. 첫 번째 헤딩, 없으면 파일명. */
export function extractTitle(markdown: string, fallback: string): string {
  const m = markdown.match(/^#\s+(.+)$/m)
  return m?.[1]?.trim() ?? fallback.replace(/\.md$/i, '')
}

/** 게시 전 검증. */
export function prepare(
  platform: Platform,
  markdown: string,
  filename: string,
): PreparedEpisode {
  const body = toPlainText(markdown)
  const counts = countAll(body)
  const t = THRESHOLDS[platform]
  const verdict = judge(platform, counts)

  const warnings: string[] = []
  const blockers: string[] = []

  const value = platform === 'novelpia' ? counts.novelpia : counts.joaraKb
  const shown = platform === 'novelpia' ? Math.round(value) : value.toFixed(1)

  if (value < t.min) {
    blockers.push(
      `분량이 플랫폼 최소 기준에 미달합니다: ${shown}${t.unit} < ${t.min}${t.unit}`,
    )
  } else if (verdict === 'below') {
    warnings.push(
      `최소 기준은 넘겼지만 목표 하한(${t.targetLow}${t.unit})에 못 미칩니다: ${shown}${t.unit}`,
    )
  }

  if (platform === 'novelpia') {
    warnings.push(
      '노벨피아 글자 수 계산은 공개된 규칙이 완전하지 않습니다. ' +
        '게시 전 편집기에서 실제 집계를 확인하세요.',
    )
  } else {
    warnings.push(
      'KB 값은 EUC-KR 기준 추정치입니다. 조아라 등록창의 실제 용량을 확인하세요.',
    )
  }

  if (body.length === 0) {
    blockers.push('본문이 비어 있습니다.')
  }

  return {
    platform,
    title: extractTitle(markdown, filename),
    body,
    warnings,
    blockers,
  }
}

/** 플랫폼 작품 등록 페이지. 반자동 흐름에서 이 주소를 연다. */
export const PLATFORM_URLS: Record<Platform, string> = {
  novelpia: 'https://novelpia.com/mypage/writer/',
  joara: 'https://www.joara.com/writer/',
}
