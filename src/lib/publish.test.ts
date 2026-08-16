import { describe, it, expect } from 'vitest'
import { toPlainText, extractTitle, prepare } from './publish'

describe('toPlainText', () => {
  it('헤딩을 본문에서 제거한다', () => {
    expect(toPlainText('# 38화\n\n본문이다.')).toBe('본문이다.')
  })

  it('강조 기호를 벗긴다', () => {
    expect(toPlainText('**굵게** 그리고 *기울임*')).toBe('굵게 그리고 기울임')
  })

  it('주석을 제거한다', () => {
    expect(toPlainText('앞 <!-- 메모 --> 뒤')).toBe('앞  뒤')
  })

  it('과도한 빈 줄을 정리한다', () => {
    expect(toPlainText('가\n\n\n\n나')).toBe('가\n\n나')
  })

  it('대사의 따옴표는 보존한다', () => {
    expect(toPlainText('"정말 몰랐어?"')).toBe('"정말 몰랐어?"')
  })
})

describe('extractTitle', () => {
  it('첫 헤딩을 제목으로 쓴다', () => {
    expect(extractTitle('# 38화 재회\n본문', 'ep_0038.md')).toBe('38화 재회')
  })

  it('헤딩이 없으면 파일명을 쓴다', () => {
    expect(extractTitle('본문만 있음', 'ep_0038.md')).toBe('ep_0038')
  })
})

describe('prepare', () => {
  it('최소 기준 미달을 blocker로 잡는다', () => {
    const r = prepare('novelpia', '짧다.', 'ep_0001.md')
    expect(r.blockers.some((b) => b.includes('최소 기준'))).toBe(true)
  })

  it('빈 본문을 blocker로 잡는다', () => {
    const r = prepare('novelpia', '# 제목만', 'ep_0001.md')
    expect(r.blockers).toContain('본문이 비어 있습니다.')
  })

  it('충분한 분량이면 blocker가 없다', () => {
    const r = prepare('novelpia', '가'.repeat(3500), 'ep_0001.md')
    expect(r.blockers).toHaveLength(0)
  })

  it('플랫폼별로 판정이 달라진다', () => {
    // 3,500자 — 노벨피아는 통과, 조아라는 6.8KB로 최소 미달
    const text = '가'.repeat(3500)
    expect(prepare('novelpia', text, 'x.md').blockers).toHaveLength(0)
    expect(prepare('joara', text, 'x.md').blockers.length).toBeGreaterThan(0)
  })

  it('추정치임을 항상 경고한다', () => {
    const r = prepare('joara', '가'.repeat(6000), 'x.md')
    expect(r.warnings.some((w) => w.includes('추정치'))).toBe(true)
  })
})
