import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

const searchMock = vi.fn()
vi.mock('@/lib/benefits/search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/benefits/search')>()),
  searchBenefits: (...a: unknown[]) => searchMock(...a),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => ({})) }))
vi.mock('@/lib/redis', () => ({
  getOrSet: async (_k: string, _t: number, f: () => Promise<unknown>) => f(),
  CACHE_KEYS: { search: (h: string) => h },
  CACHE_TTL: { search: 1, searchKeyword: 1 },
}))
const rateLimitMock = vi.fn(async () => true)
vi.mock('@/lib/rate-limit', () => ({ rateLimit: (...a: unknown[]) => rateLimitMock(...(a as [])) }))

import { GET } from '@/app/api/benefits/search/route'

describe('GET /api/benefits/search', () => {
  it('총 개수와 항목을 돌려준다', async () => {
    searchMock.mockResolvedValue({ total: 27, items: [{ slug: 'a' }] })
    const res = await GET(new NextRequest('http://localhost/api/benefits/search?age=30s&situations=pregnancy&region=seoul'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ total: 27, items: [{ slug: 'a' }] })
    expect(res.headers.get('cache-control')).toContain('s-maxage')
    const input = searchMock.mock.calls[0][1]
    expect(input).toMatchObject({ ageBand: '30s', situations: ['pregnancy'], region: 'seoul' })
  })
  it('오류는 500', async () => {
    searchMock.mockRejectedValue(new Error('db'))
    const res = await GET(new NextRequest('http://localhost/api/benefits/search'))
    expect(res.status).toBe(500)
  })

  it('레이트 리밋에 걸리면 429를 돌려주고 검색은 실행하지 않는다', async () => {
    // 검색어가 자유 입력이라 캐시 키 공간이 무한하다. 리밋이 없으면 q를 바꿔가며
    // 전건 스캔과 Redis 쓰기를 무한히 유발할 수 있다.
    searchMock.mockClear()
    rateLimitMock.mockResolvedValueOnce(false)
    const res = await GET(
      new NextRequest('http://localhost/api/benefits/search?q=월세', { headers: { 'x-forwarded-for': '1.2.3.4' } }),
    )
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('60')
    expect(searchMock).not.toHaveBeenCalled()
  })

  it('클라이언트를 식별할 수 없으면 제한하지 않는다', async () => {
    // 식별 불가 요청을 한 바구니에 몰면 무관한 사용자끼리 카운터를 공유해 전원이 막힌다.
    rateLimitMock.mockClear()
    searchMock.mockResolvedValue({ total: 1, items: [] })
    const res = await GET(new NextRequest('http://localhost/api/benefits/search'))
    expect(res.status).toBe(200)
    expect(rateLimitMock).not.toHaveBeenCalled()
  })
})
