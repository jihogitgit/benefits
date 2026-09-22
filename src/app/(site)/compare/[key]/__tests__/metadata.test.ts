import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PeerItem } from '@/lib/benefits/peer-group'

const group = vi.fn<(key: string) => Promise<PeerItem[] | null>>()
vi.mock('@/lib/benefits/queries', () => ({ getPeerGroup: (k: string) => group(k) }))

import { generateMetadata } from '../page'

const item = (slug: string, title: string, region_code: string, agency: string | null): PeerItem => ({ slug, title, region_code, agency })

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
  group.mockReset()
})

const meta = (key: string) => generateMetadata({ params: Promise.resolve({ key }) })

describe('비교 페이지 메타데이터', () => {
  /*
   * absoluteUrl이 경로 조각마다 인코딩한다. 페이지가 한 번 더 걸어 운영의 canonical이
   * 전부 %25로 시작하는 없는 주소를 가리킨 적이 있다. 사이트맵 쪽도 같은 실수였다.
   */
  it('canonical을 한 번만 인코딩한다', async () => {
    group.mockResolvedValue([
      item('a', '출산장려금 지원', 'seoul', '서울특별시 송파구'),
      item('b', '출산장려금 지원', 'busan', '부산광역시 중구'),
      item('c', '출산장려금 지원', 'jeonnam', '전라남도 완도군'),
    ])
    const m = await meta(encodeURIComponent('출산장려금'))
    expect(m.alternates?.canonical).toBe(`https://example.com/compare/${encodeURIComponent('출산장려금')}`)
    expect(m.alternates?.canonical).not.toContain('%25')
  })

  // 제목·설명이 세는 것은 건수가 아니라 지자체 수다. 한 지자체가 같은 사업을 여러 건
  // 등록한 묶음이 실제로 7개 있고, 31건이 22곳인 것도 있다.
  it('건수가 아니라 지자체 수를 센다', async () => {
    group.mockResolvedValue([
      item('a', '체육시설 이용요금 감면', 'seoul', '서울특별시 송파구'),
      item('b', '체육시설 이용요금 감면', 'seoul', '서울특별시 송파구'),
      item('c', '체육시설 이용요금 감면', 'busan', '부산광역시 중구'),
      item('d', '체육시설 이용요금 감면', 'jeonnam', '전라남도 완도군'),
    ])
    const m = await meta(encodeURIComponent('체육시설이용요금감면'))
    expect(m.title).toContain('3곳')
    expect(m.title).not.toContain('4곳')
  })

  // 붙일 말이 데이터에서 온다. 하나로 고정하면 절반이 틀린 한국어로 발행된다.
  it('조사를 받침에 맞춘다', async () => {
    const three = (t: string) => [item('a', t, 'seoul', '서울특별시 송파구'), item('b', t, 'busan', '부산광역시 중구'), item('c', t, 'jeonnam', '전라남도 완도군')]
    group.mockResolvedValue(three('출산장려금 지원'))
    expect((await meta(encodeURIComponent('출산장려금'))).description).toContain('출산장려금을 운영하는')
    group.mockResolvedValue(three('산모신생아 건강관리'))
    expect((await meta(encodeURIComponent('산모신생아건강관리'))).description).toContain('산모신생아건강관리를 운영하는')
  })

  it('지역이 5곳 미만이면 noindex다', async () => {
    group.mockResolvedValue([
      item('a', '벼육묘 지원', 'seoul', null),
      item('b', '벼육묘 지원', 'busan', null),
      item('c', '벼육묘 지원', 'jeonnam', null),
    ])
    expect((await meta(encodeURIComponent('벼육묘'))).robots).toMatchObject({ index: false })
  })

  it('없는 열쇠는 빈 메타데이터', async () => {
    group.mockResolvedValue(null)
    expect(await meta(encodeURIComponent('없는것'))).toEqual({})
  })
})
