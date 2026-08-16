import { describe, it, expect } from 'vitest'
import {
  countNovelpia,
  countWithoutSpaces,
  eucKrByteLength,
  countAll,
  judge,
  remaining,
} from './count'

describe('countNovelpia', () => {
  it('공백을 제외한다', () => {
    expect(countNovelpia('가 나 다')).toBe(3)
    expect(countNovelpia('가\t나\n다')).toBe(3)
  })

  it('마침표·느낌표·물음표를 제외한다', () => {
    expect(countNovelpia('안녕.')).toBe(2)
    expect(countNovelpia('안녕!')).toBe(2)
    expect(countNovelpia('안녕?')).toBe(2)
  })

  it('따옴표를 제외한다 (ASCII와 조판용 모두)', () => {
    expect(countNovelpia('"안녕"')).toBe(2)
    expect(countNovelpia('“안녕”')).toBe(2)
    expect(countNovelpia('「안녕」')).toBe(2)
  })

  it('쉼표는 제외하지 않는다 (공식 목록에 없음)', () => {
    expect(countNovelpia('안녕,')).toBe(3)
  })

  it('실제 대사 한 줄', () => {
    // "정말 몰랐어?"  →  정말몰랐어 = 5자
    expect(countNovelpia('"정말 몰랐어?"')).toBe(5)
  })
})

describe('countWithoutSpaces', () => {
  it('공백만 제외하고 문장부호는 센다', () => {
    expect(countWithoutSpaces('"정말 몰랐어?"')).toBe(8)
  })
})

describe('eucKrByteLength', () => {
  it('한글은 2바이트', () => {
    expect(eucKrByteLength('가')).toBe(2)
    expect(eucKrByteLength('안녕하세요')).toBe(10)
  })

  it('ASCII는 1바이트', () => {
    expect(eucKrByteLength('abc')).toBe(3)
    expect(eucKrByteLength(' ')).toBe(1)
  })

  it('혼합', () => {
    expect(eucKrByteLength('a가')).toBe(3)
  })

  it('리서치 문서의 10KB ≈ 5,000자 기술과 일치한다', () => {
    const text = '가'.repeat(5000)
    const kb = eucKrByteLength(text) / 1024
    expect(kb).toBeGreaterThan(9.7)
    expect(kb).toBeLessThan(10.0)
  })
})

describe('judge', () => {
  it('노벨피아 목표 하한 미달을 below로 본다', () => {
    const counts = countAll('가'.repeat(3000))
    expect(judge('novelpia', counts)).toBe('below')
  })

  it('노벨피아 목표 구간을 ok로 본다', () => {
    const counts = countAll('가'.repeat(3500))
    expect(judge('novelpia', counts)).toBe('ok')
  })

  it('노벨피아 목표 상한 초과를 above로 본다', () => {
    const counts = countAll('가'.repeat(5000))
    expect(judge('novelpia', counts)).toBe('above')
  })

  it('조아라는 KB로 판정한다', () => {
    // 6,000자 = 12,000바이트 ≈ 11.7KB → 목표 구간
    expect(judge('joara', countAll('가'.repeat(6000)))).toBe('ok')
    // 2,000자 = 4,000바이트 ≈ 3.9KB → 미달
    expect(judge('joara', countAll('가'.repeat(2000)))).toBe('below')
  })
})

describe('remaining', () => {
  it('부족분을 알려준다', () => {
    const counts = countAll('가'.repeat(3000))
    expect(remaining('novelpia', counts)).toBe(300)
  })

  it('충족했으면 0', () => {
    const counts = countAll('가'.repeat(4000))
    expect(remaining('novelpia', counts)).toBe(0)
  })
})

describe('두 플랫폼의 단위 차이', () => {
  it('같은 원고가 한쪽만 충족할 수 있다', () => {
    // 3,400자: 노벨피아는 충족, 조아라는 6.6KB로 미달
    const counts = countAll('가'.repeat(3400))
    expect(judge('novelpia', counts)).toBe('ok')
    expect(judge('joara', counts)).toBe('below')
  })
})
