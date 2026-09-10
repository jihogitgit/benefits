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
  CACHE_TTL: { search: 1 },
}))

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
})
