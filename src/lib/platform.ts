/**
 * 대상 플랫폼 설정.
 *
 * 앱과 집필 규칙이 같은 값을 봐야 하므로, 설정은 vault/PLATFORM.md 에 저장한다.
 * AGENTS.md 가 "대상 플랫폼이 미설정이면 사용자에게 묻는다"고 규정하고 있어서,
 * 앱에서 고른 값이 파일에 반영되지 않으면 Codex/Claude 쪽이 계속 되묻게 된다.
 */

import type { Platform } from './count'

const SETTING_LINE = /^대상 플랫폼:.*$/m

export const PLATFORM_LABEL: Record<Platform, string> = {
  novelpia: '노벨피아',
  joara: '조아라',
}

/** PLATFORM.md 본문에서 현재 설정된 플랫폼을 읽는다. */
export function parsePlatform(markdown: string): Platform | null {
  const line = markdown.match(SETTING_LINE)?.[0]
  if (!line) return null

  // 주석(<!-- 노벨피아 | 조아라 -->)에 두 이름이 다 들어 있으므로 먼저 걷어낸다.
  const value = line.replace(/<!--[\s\S]*?-->/g, '')

  if (value.includes('미설정')) return null

  const hasNovelpia = value.includes('노벨피아')
  const hasJoara = value.includes('조아라')

  // 둘 다 적혀 있으면 어느 쪽인지 단정할 수 없다.
  if (hasNovelpia && hasJoara) return null
  if (hasNovelpia) return 'novelpia'
  if (hasJoara) return 'joara'
  return null
}

/** PLATFORM.md 본문의 설정 줄을 갱신한 새 본문을 돌려준다. */
export function applyPlatform(markdown: string, platform: Platform): string {
  const next = `대상 플랫폼: ${PLATFORM_LABEL[platform]}`
  if (SETTING_LINE.test(markdown)) {
    return markdown.replace(SETTING_LINE, next)
  }
  // 설정 줄이 없으면 문서 앞쪽에 넣는다.
  return `${next}\n\n${markdown}`
}
