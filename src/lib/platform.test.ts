import { describe, it, expect } from 'vitest'
import { parsePlatform, applyPlatform } from './platform'

const TEMPLATE = `# PLATFORM

## 현재 대상 플랫폼

대상 플랫폼: <!-- 노벨피아 | 조아라 | 둘 다 --> (미설정)

작품명:
`

describe('parsePlatform', () => {
  it('미설정 상태를 null로 읽는다', () => {
    expect(parsePlatform(TEMPLATE)).toBe(null)
  })

  it('주석에 두 이름이 있어도 미설정으로 본다', () => {
    // 주석을 걷어내지 않으면 노벨피아로 잘못 읽힌다
    expect(parsePlatform('대상 플랫폼: <!-- 노벨피아 | 조아라 --> (미설정)')).toBe(null)
  })

  it('노벨피아를 읽는다', () => {
    expect(parsePlatform('대상 플랫폼: 노벨피아')).toBe('novelpia')
  })

  it('조아라를 읽는다', () => {
    expect(parsePlatform('대상 플랫폼: 조아라')).toBe('joara')
  })

  it('둘 다 적혀 있으면 단정하지 않는다', () => {
    expect(parsePlatform('대상 플랫폼: 노벨피아, 조아라')).toBe(null)
  })

  it('설정 줄이 없으면 null', () => {
    expect(parsePlatform('# PLATFORM\n\n작품명:')).toBe(null)
  })
})

describe('applyPlatform', () => {
  it('설정 줄을 갱신한다', () => {
    const out = applyPlatform(TEMPLATE, 'joara')
    expect(out).toContain('대상 플랫폼: 조아라')
    expect(out).not.toContain('미설정')
  })

  it('갱신 후 다시 읽으면 같은 값이 나온다', () => {
    for (const p of ['novelpia', 'joara'] as const) {
      expect(parsePlatform(applyPlatform(TEMPLATE, p))).toBe(p)
    }
  })

  it('다른 내용은 건드리지 않는다', () => {
    const out = applyPlatform(TEMPLATE, 'novelpia')
    expect(out).toContain('# PLATFORM')
    expect(out).toContain('작품명:')
  })

  it('설정 줄이 없으면 추가한다', () => {
    const out = applyPlatform('# PLATFORM\n', 'joara')
    expect(parsePlatform(out)).toBe('joara')
  })
})
