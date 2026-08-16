/**
 * 플랫폼별 분량 계산.
 *
 * 두 플랫폼은 산정 단위가 아예 다르다.
 *   - 노벨피아: 글자 수. 공백 외에 일부 문장부호도 제외한다.
 *   - 조아라:   KB 용량. 글자 수가 아니다.
 *
 * 근거는 docs/research/ 의 리서치 문서 참조.
 */

/** 노벨피아 집계에서 제외되는 문자.
 *
 *  공식 FAQ 기준: 띄어쓰기, 마침표, 따옴표, 개행, 탭, 느낌표, 물음표 "등".
 *  "등"이라고만 명시되어 있어 전체 목록이 공개되어 있지 않다.
 *  따라서 이 계산은 확정값이 아니라 하한 추정에 가깝다 —
 *  실제 집계는 이보다 더 적게 나올 수 있으므로 기준선에 아슬아슬하게 맞추지 않는다.
 */
const NOVELPIA_EXCLUDED = new Set([
  // 공백류
  ' ', '\t', '\n', '\r', ' ', '　',
  // 마침표
  '.',
  // 느낌표 / 물음표
  '!', '?',
  // 따옴표 (ASCII + 한국어 조판용)
  '"', "'", '“', '”', '‘', '’',
  '「', '」', '『', '』',
])

export interface Counts {
  /** 전체 문자 수 (공백 포함) */
  raw: number
  /** 공백만 제외한 문자 수 — 일반 워드프로세서가 보여주는 값 */
  withoutSpaces: number
  /** 노벨피아 집계 추정치 */
  novelpia: number
  /** 조아라 KB 추정치 (EUC-KR 바이트 기준) */
  joaraKb: number
  /** 참고용 UTF-8 바이트 */
  utf8Bytes: number
}

/** 노벨피아 집계 기준 글자 수(추정). */
export function countNovelpia(text: string): number {
  let n = 0
  for (const ch of text) {
    if (!NOVELPIA_EXCLUDED.has(ch)) n++
  }
  return n
}

/** 공백만 제외한 글자 수. */
export function countWithoutSpaces(text: string): number {
  let n = 0
  for (const ch of text) {
    if (!/\s/.test(ch)) n++
  }
  return n
}

/**
 * EUC-KR(CP949) 인코딩 기준 바이트 길이.
 *
 * 조아라의 KB는 글자 수가 아니라 용량이며, 리서치 문서의
 * "10KB ≈ 5,000자" 기술은 한글 1자 = 2바이트인 EUC-KR 계열 집계를 가리킨다.
 * (UTF-8이면 한글 1자 = 3바이트라 10KB가 약 3,400자가 되어 맞지 않는다.)
 *
 * EUC-KR로 표현할 수 없는 문자(이모지 등)는 2바이트로 근사한다.
 */
export function eucKrByteLength(text: string): number {
  let bytes = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    bytes += cp < 0x80 ? 1 : 2
  }
  return bytes
}

/** UTF-8 바이트 길이. */
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

export function countAll(text: string): Counts {
  const eucKr = eucKrByteLength(text)
  return {
    raw: [...text].length,
    withoutSpaces: countWithoutSpaces(text),
    novelpia: countNovelpia(text),
    joaraKb: eucKr / 1024,
    utf8Bytes: utf8ByteLength(text),
  }
}

// ── 플랫폼 기준선 ──────────────────────────────────────────────

export type Platform = 'novelpia' | 'joara'

export interface Threshold {
  /** 플랫폼이 요구하는 최소치 */
  min: number
  /** 안전 마진을 둔 실무 목표 하한 */
  targetLow: number
  /** 실무 목표 상한 */
  targetHigh: number
  unit: string
}

export const THRESHOLDS: Record<Platform, Threshold> = {
  // 플러스 전환: 회차당 공백 미포함 3,000자 이상
  novelpia: { min: 3000, targetLow: 3300, targetHigh: 4200, unit: '자' },
  // 성실연재 평균 10KB, 프리미엄 회차당 10KB / 평균 12KB
  joara: { min: 10, targetLow: 10, targetHigh: 12, unit: 'KB' },
}

export type Verdict = 'below' | 'ok' | 'above'

/** 현재 분량이 기준을 만족하는지. */
export function judge(platform: Platform, counts: Counts): Verdict {
  const t = THRESHOLDS[platform]
  const value = platform === 'novelpia' ? counts.novelpia : counts.joaraKb
  if (value < t.targetLow) return 'below'
  if (value > t.targetHigh) return 'above'
  return 'ok'
}

/** 목표 하한까지 얼마나 남았는지. 이미 넘었으면 0. */
export function remaining(platform: Platform, counts: Counts): number {
  const t = THRESHOLDS[platform]
  const value = platform === 'novelpia' ? counts.novelpia : counts.joaraKb
  return Math.max(0, t.targetLow - value)
}
