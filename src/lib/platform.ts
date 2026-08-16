/**
 * 대상 플랫폼 설정.
 *
 * 앱과 집필 규칙이 같은 값을 봐야 하므로, 설정은 vault/PLATFORM.md 에 저장한다.
 * AGENTS.md 가 "대상 플랫폼이 미설정이면 사용자에게 묻는다"고 규정하고 있어서,
 * 앱에서 고른 값이 파일에 반영되지 않으면 Codex 쪽이 계속 되묻게 된다.
 *
 * 한 작품을 두 플랫폼에 동시 연재할 수 있으므로 여러 개를 고를 수 있다.
 * 그 경우 분량 기준을 둘 다 만족해야 한다 — 노벨피아는 글자 수,
 * 조아라는 KB 라서 한쪽만 맞추면 다른 쪽이 미달한다.
 */

import type { Platform } from './count'

const SETTING_LINE = /^대상 플랫폼:.*$/m

export const PLATFORM_LABEL: Record<Platform, string> = {
  novelpia: '노벨피아',
  joara: '조아라',
}

/** 로그인 안내 순서. 조아라가 먼저다. */
export const PLATFORM_ORDER: Platform[] = ['joara', 'novelpia']

/** PLATFORM.md 본문에서 설정된 플랫폼들을 읽는다. */
export function parsePlatforms(markdown: string): Platform[] {
  const line = markdown.match(SETTING_LINE)?.[0]
  if (!line) return []

  // 주석(<!-- 노벨피아 | 조아라 -->)에 두 이름이 다 들어 있으므로 먼저 걷어낸다.
  const value = line.replace(/<!--[\s\S]*?-->/g, '')
  if (value.includes('미설정')) return []

  const found: Platform[] = []
  if (value.includes('노벨피아')) found.push('novelpia')
  if (value.includes('조아라')) found.push('joara')
  return found
}

/** PLATFORM.md 본문의 설정 줄을 갱신한 새 본문을 돌려준다. */
export function applyPlatforms(markdown: string, platforms: Platform[]): string {
  const value = platforms.length
    ? platforms.map((p) => PLATFORM_LABEL[p]).join(', ')
    : '(미설정)'
  const next = `대상 플랫폼: ${value}`

  if (SETTING_LINE.test(markdown)) {
    return markdown.replace(SETTING_LINE, next)
  }
  return `${next}\n\n${markdown}`
}

/** 정렬된 라벨 문자열. */
export function describe(platforms: Platform[]): string {
  if (!platforms.length) return '미설정'
  return PLATFORM_ORDER.filter((p) => platforms.includes(p))
    .map((p) => PLATFORM_LABEL[p])
    .join(' · ')
}
