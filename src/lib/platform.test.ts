import { describe as suite, it, expect } from 'vitest'
import { parsePlatforms, applyPlatforms, describe } from './platform'

const TEMPLATE = `# PLATFORM

## 현재 대상 플랫폼

대상 플랫폼: <!-- 노벨피아 | 조아라 | 둘 다 --> (미설정)

작품명:
`

suite('parsePlatforms', () => {
  it('미설정 상태를 빈 배열로 읽는다', () => {
    expect(parsePlatforms(TEMPLATE)).toEqual([])
  })

  it('주석에 두 이름이 있어도 미설정으로 본다', () => {
    // 주석을 걷어내지 않으면 둘 다 선택된 것으로 잘못 읽힌다
    expect(parsePlatforms('대상 플랫폼: <!-- 노벨피아 | 조아라 --> (미설정)')).toEqual([])
  })

  it('한 곳만 읽는다', () => {
    expect(parsePlatforms('대상 플랫폼: 노벨피아')).toEqual(['novelpia'])
    expect(parsePlatforms('대상 플랫폼: 조아라')).toEqual(['joara'])
  })

  it('두 곳을 함께 읽는다', () => {
    expect(parsePlatforms('대상 플랫폼: 노벨피아, 조아라')).toEqual(['novelpia', 'joara'])
  })

  it('설정 줄이 없으면 빈 배열', () => {
    expect(parsePlatforms('# PLATFORM\n\n작품명:')).toEqual([])
  })
})

suite('applyPlatforms', () => {
  it('한 곳을 기록한다', () => {
    const out = applyPlatforms(TEMPLATE, ['joara'])
    expect(out).toContain('대상 플랫폼: 조아라')
    expect(out).not.toContain('미설정')
  })

  it('두 곳을 기록한다', () => {
    const out = applyPlatforms(TEMPLATE, ['novelpia', 'joara'])
    expect(out).toContain('대상 플랫폼: 노벨피아, 조아라')
  })

  it('빈 선택은 미설정으로 되돌린다', () => {
    expect(applyPlatforms('대상 플랫폼: 조아라', [])).toContain('(미설정)')
  })

  it('왕복해도 값이 유지된다', () => {
    const cases: Array<Parameters<typeof applyPlatforms>[1]> = [
      ['novelpia'],
      ['joara'],
      ['novelpia', 'joara'],
    ]
    for (const c of cases) {
      expect(parsePlatforms(applyPlatforms(TEMPLATE, c))).toEqual(c)
    }
  })

  it('다른 내용은 건드리지 않는다', () => {
    const out = applyPlatforms(TEMPLATE, ['novelpia'])
    expect(out).toContain('# PLATFORM')
    expect(out).toContain('작품명:')
  })
})

suite('describe', () => {
  it('조아라를 먼저 보여준다', () => {
    expect(describe(['novelpia', 'joara'])).toBe('조아라 · 노벨피아')
  })

  it('미설정 표시', () => {
    expect(describe([])).toBe('미설정')
  })
})
