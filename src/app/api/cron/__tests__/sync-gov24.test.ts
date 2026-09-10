import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const runMock = vi.fn()
vi.mock('@/lib/sync/gov24-sync', () => ({ runGov24Sync: (...args: unknown[]) => runMock(...args) }))
vi.mock('@/lib/sync/supabase-repo', () => ({ createSupabaseRepo: vi.fn(() => ({})) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => ({})) }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

import { GET } from '@/app/api/cron/sync-gov24/route'
import { revalidateTag } from 'next/cache'

const ok = { fetched: 10, changed: 2, upserted: 2, skipped: 8, failed: 0, closed: 0, removed: 0, aborted_reason: null, changedSlugs: ['a', 'b'], changedSegments: ['youth'] }

describe('GET /api/cron/sync-gov24', () => {
  beforeEach(() => {
    runMock.mockReset()
    vi.mocked(revalidateTag).mockClear()
    process.env.CRON_SECRET = 'secret'
  })

  it('토큰 없으면 401', async () => {
    const res = await GET(new NextRequest('http://localhost/api/cron/sync-gov24'))
    expect(res.status).toBe(401)
    expect(runMock).not.toHaveBeenCalled()
  })

  it('성공 시 결과와 함께 변경 태그를 재검증한다', async () => {
    runMock.mockResolvedValue(ok)
    const res = await GET(new NextRequest('http://localhost/api/cron/sync-gov24', { headers: { authorization: 'Bearer secret' } }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ upserted: 2, changedSlugs: 2 })
    expect(revalidateTag).toHaveBeenCalledWith('benefit:a')
    expect(revalidateTag).toHaveBeenCalledWith('benefit:b')
    expect(revalidateTag).toHaveBeenCalledWith('segment:youth')
    expect(revalidateTag).toHaveBeenCalledWith('benefits:home')
  })

  it('변경이 없으면 홈 태그를 건드리지 않는다', async () => {
    runMock.mockResolvedValue({ ...ok, changed: 0, upserted: 0, closed: 0, changedSlugs: [], changedSegments: [] })
    await GET(new NextRequest('http://localhost/api/cron/sync-gov24', { headers: { authorization: 'Bearer secret' } }))
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('급감 중단은 409', async () => {
    runMock.mockResolvedValue({ ...ok, changed: 0, upserted: 0, aborted_reason: '건수 급감', changedSlugs: [], changedSegments: [] })
    const res = await GET(new NextRequest('http://localhost/api/cron/sync-gov24', { headers: { authorization: 'Bearer secret' } }))
    expect(res.status).toBe(409)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('예외는 500', async () => {
    runMock.mockRejectedValue(new Error('boom'))
    const res = await GET(new NextRequest('http://localhost/api/cron/sync-gov24', { headers: { authorization: 'Bearer secret' } }))
    expect(res.status).toBe(500)
  })
})
