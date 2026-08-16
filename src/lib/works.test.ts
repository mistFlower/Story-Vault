import { describe, it, expect } from 'vitest'
import { renderWork, renderMetrics, applyWorkMeta, type Work } from './works'
import { parsePlatforms } from './platform'

const WORK: Work = {
  id: '12345',
  title: '삭제된 계정',
  platform: 'novelpia',
  url: 'https://novelpia.com/novel/12345',
  genre: '현대판타지',
  tags: ['회귀', '헌터'],
  status: '연재중',
  episodeCount: 38,
  lastPublishedAt: '2026-08-15',
}

const FETCHED = '2026-08-16 17:00'

describe('renderWork', () => {
  it('작품 정보를 담는다', () => {
    const out = renderWork(WORK, FETCHED)
    expect(out).toContain('작품명: 삭제된 계정')
    expect(out).toContain('플랫폼: 노벨피아')
    expect(out).toContain('공개 회차: 38')
    expect(out).toContain('- 회귀')
  })

  it('자동 생성 파일임을 명시한다', () => {
    expect(renderWork(WORK, FETCHED)).toContain('직접 수정하지 않는다')
  })

  it('빈 값을 안전하게 처리한다', () => {
    const bare: Work = { id: '1', title: '제목', platform: 'joara' }
    const out = renderWork(bare, FETCHED)
    expect(out).toContain('장르: —')
    expect(out).toContain('- (없음)')
  })
})

describe('renderMetrics', () => {
  it('회차를 표로 만든다', () => {
    const out = renderMetrics(
      'joara',
      [{ number: 1, title: '프롤로그', publishedAt: '2026-01-01', size: '11.2KB', views: 1200 }],
      FETCHED,
    )
    expect(out).toContain('| 1 | 프롤로그 | 2026-01-01 | 11.2KB | 1,200 |')
  })

  it('플랫폼에 따라 분량 열 이름이 바뀐다', () => {
    expect(renderMetrics('novelpia', [], FETCHED)).toContain('글자 수')
    expect(renderMetrics('joara', [], FETCHED)).toContain('용량')
  })

  it('제목의 파이프를 이스케이프해 표가 깨지지 않게 한다', () => {
    const out = renderMetrics('joara', [{ number: 1, title: 'a|b' }], FETCHED)
    const row = out.split('\n').find((l) => l.startsWith('| 1 |'))!

    // 이스케이프된 형태로 들어가야 한다
    expect(row).toContain('a\\|b')

    // 이스케이프를 걷어낸 뒤 세면 열 수가 정상이어야 한다.
    // (split('|') 은 \| 도 나누므로 먼저 치환해야 의미가 있다)
    const columns = row.replace(/\\\|/g, '¦').split('|')
    expect(columns.length).toBe(9)
  })

  it('회차가 없어도 표가 유효하다', () => {
    const out = renderMetrics('novelpia', [], FETCHED)
    expect(out).toContain('회차 수: 0')
  })
})

describe('applyWorkMeta', () => {
  const TEMPLATE = `# PLATFORM

대상 플랫폼: 노벨피아

작품명:
연재 시작일:
현재 공개 회차:
`

  it('작품명과 회차를 채운다', () => {
    const out = applyWorkMeta(TEMPLATE, WORK)
    expect(out).toContain('작품명: 삭제된 계정')
    expect(out).toContain('현재 공개 회차: 38')
  })

  it('대상 플랫폼 줄을 건드리지 않는다', () => {
    expect(parsePlatforms(applyWorkMeta(TEMPLATE, WORK))).toEqual(['novelpia'])
  })

  it('회차 수를 모르면 그 줄은 그대로 둔다', () => {
    const out = applyWorkMeta(TEMPLATE, { id: '1', title: 'x', platform: 'joara' })
    expect(out).toContain('현재 공개 회차:\n')
  })
})
