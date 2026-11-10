import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const runMock = vi.fn()
const housingMock = vi.fn()
vi.mock('@/lib/sync/gov24-sync', () => ({ runGov24Sync: (...args: unknown[]) => runMock(...args) }))
vi.mock('@/lib/sync/housing-sync', () => ({ runHousingSync: (...args: unknown[]) => housingMock(...args) }))
vi.mock('@/lib/sync/supabase-repo', () => ({ createSupabaseRepo: vi.fn(() => ({})) }))
vi.mock('@/lib/sync/housing-repo', () => ({ createHousingRepo: vi.fn(() => ({})) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => ({})) }))
vi.mock('@/lib/api/applyhome', () => ({ fetchApplyhomeDetails: vi.fn(), fetchApplyhomeUnits: vi.fn() }))
vi.mock('@/lib/api/lh', () => ({ fetchLhNotices: vi.fn() }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

import { GET } from '@/app/api/cron/sync/route'
import { revalidateTag } from 'next/cache'
import { benefitTag, housingTag } from '@/lib/cache-tags'

const ok = {
  fetched: 10, changed: 2, upserted: 2, skipped: 8, failed: 0, closed: 0, removed: 0, aborted_reason: null,
  changedSlugs: ['a', 'b'], closedSlugs: [] as string[], removedSlugs: [] as string[], changedSegments: ['youth'],
}
const quiet = { ...ok, changed: 0, upserted: 0, closed: 0, removed: 0, changedSlugs: [], closedSlugs: [], removedSlugs: [], changedSegments: [] }

const authed = () => new NextRequest('http://localhost/api/cron/sync', { headers: { authorization: 'Bearer secret' } })
const calledTags = () => vi.mocked(revalidateTag).mock.calls.map(([t]) => String(t))

describe('GET /api/cron/sync', () => {
  beforeEach(() => {
    runMock.mockReset()
    housingMock.mockReset()
    vi.mocked(revalidateTag).mockClear()
    process.env.CRON_SECRET = 'secret'
  })

  it('토큰 없으면 401', async () => {
    const res = await GET(new NextRequest('http://localhost/api/cron/sync'))
    expect(res.status).toBe(401)
    expect(runMock).not.toHaveBeenCalled()
  })

  // 비교 대상이 `Bearer ${undefined}`가 되면 "Bearer undefined"로 누구나 통과한다.
  it('CRON_SECRET이 비어 있으면 Bearer undefined로도 들어올 수 없다', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(new NextRequest('http://localhost/api/cron/sync', { headers: { authorization: 'Bearer undefined' } }))
    expect(res.status).toBe(500)
    expect(runMock).not.toHaveBeenCalled()
  })

  it('성공 시 결과와 함께 목록·홈 태그와 바뀐 슬러그의 태그를 재검증한다', async () => {
    runMock.mockResolvedValue(ok)
    const res = await GET(authed())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ gov24: { upserted: 2, changedSlugs: 2, invalidated: 'per-slug' }, housing: null })
    expect(calledTags().sort()).toEqual([benefitTag('a'), benefitTag('b'), 'benefits:home', 'benefits:lists'].sort())
  })

  // benefits:all은 상세 1만 장을 낡은 것으로 표시해 그 뒤 크롤러 방문마다 재생성(ISR 쓰기)을 일으킨다.
  it('평소 변경에는 benefits:all을 쏘지 않는다', async () => {
    runMock.mockResolvedValue(ok)
    await GET(authed())
    expect(calledTags()).not.toContain('benefits:all')
  })

  it('마감·소멸된 슬러그도 한 장씩 비우고, 겹치면 한 번만 부른다', async () => {
    runMock.mockResolvedValue({ ...quiet, closed: 2, removed: 1, closedSlugs: ['c', 'a'], removedSlugs: ['r'], changedSlugs: ['a'], changed: 1 })
    await GET(authed())
    const perSlug = calledTags().filter((t) => t.startsWith('benefit:'))
    expect(perSlug.sort()).toEqual([benefitTag('a'), benefitTag('c'), benefitTag('r')].sort())
  })

  // 원천이 갱신 시각을 통째로 바꾸는 날(10,947건 전부 변경) 만 번의 호출로 maxDuration을 위협했던 회귀를 막는다.
  it('대량 변경이면 슬러그별 대신 benefits:all 한 번으로 비운다', async () => {
    const many = Array.from({ length: 101 }, (_, i) => `s${i}`)
    runMock.mockResolvedValue({ ...ok, changed: many.length, upserted: many.length, changedSlugs: many })
    const res = await GET(authed())
    expect(await res.json()).toMatchObject({ gov24: { invalidated: 'all' } })
    const tags = calledTags()
    expect(tags).toContain('benefits:all')
    expect(tags.some((t) => t.startsWith('benefit:'))).toBe(false)
    expect(tags).toHaveLength(3)
  })

  // 카드의 D-day와 "최종 동기화" 시각은 하루가 지나면 틀린다. 목록은 수십 장이라 매번 비워도 싸다.
  it('변경이 없어도 홈·목록 태그는 비우고 상세는 건드리지 않는다', async () => {
    runMock.mockResolvedValue(quiet)
    const res = await GET(authed())
    expect(await res.json()).toMatchObject({ gov24: { invalidated: 'none' } })
    expect(calledTags().sort()).toEqual(['benefits:home', 'benefits:lists'])
  })

  it('급감 중단은 409', async () => {
    runMock.mockResolvedValue({ ...quiet, aborted_reason: '건수 급감' })
    const res = await GET(authed())
    expect(res.status).toBe(409)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('예외는 500이고 내부 메시지는 응답에 싣지 않는다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    runMock.mockRejectedValue(new Error('db password wrong'))
    const res = await GET(authed())
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('password')
  })

  // 중간 실패는 어떤 행이 반영됐는지 모른다. 다음 실행이 '변경 없음'으로 건너뛰면 일주일 낡은 채 남는다.
  it('중간에 실패하면 어떤 슬러그가 반영됐는지 모르므로 전부 비운다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    runMock.mockRejectedValue(new Error('boom'))
    await GET(authed())
    expect(calledTags()).toContain('benefits:all')
  })

  it('슬러그 모양이 아닌 값이 섞여도 나머지는 비우고 500을 내지 않는다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    runMock.mockResolvedValue({ ...ok, changedSlugs: ['a', 'bad slug'] })
    const res = await GET(authed())
    expect(res.status).toBe(200)
    expect(calledTags()).toContain(benefitTag('a'))
  })

  it('KST 1월 1일에는 제목 연도 때문에 전부 비운다', async () => {
    vi.useFakeTimers({ now: new Date('2026-12-31T16:00:00Z'), toFake: ['Date'] }) // KST 2027-01-01 01:00
    try {
      runMock.mockResolvedValue(quiet)
      const res = await GET(authed())
      expect(await res.json()).toMatchObject({ gov24: { invalidated: 'all' } })
      expect(calledTags()).toContain('benefits:all')
    } finally {
      vi.useRealTimers()
    }
  })
})

const housingOk = {
  applyhome: { source: 'applyhome', fetched: 10, changed: 2, upserted: 2, skipped: 8, failed: 0, removed: 1, aborted_reason: null, error: null, changedSlugs: ['h1', 'h2'], removedSlugs: ['h3'] },
  lh: { source: 'lh', fetched: 5, changed: 0, upserted: 0, skipped: 5, failed: 0, removed: 0, aborted_reason: null, error: null, changedSlugs: [], removedSlugs: [] },
}
const housingReq = () => new NextRequest('http://localhost/api/cron/sync?housing=1', { headers: { authorization: 'Bearer secret' } })

describe('GET /api/cron/sync — 공고', () => {
  beforeEach(() => {
    housingMock.mockReset()
    vi.mocked(revalidateTag).mockClear()
    process.env.CRON_SECRET = 'secret'
    runMock.mockReset()
    runMock.mockResolvedValue(quiet)
  })

  it('housing=1이 없으면 공고 동기화를 돌리지 않는다', async () => {
    await GET(authed())
    expect(housingMock).not.toHaveBeenCalled()
  })

  it('housing=1이면 보조금24 뒤에 공고를 돌리고 목록 태그와 바뀐 슬러그만 비운다', async () => {
    housingMock.mockResolvedValue(housingOk)
    const res = await GET(housingReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.housing).toMatchObject({ applyhome: { upserted: 2, changedSlugs: 2, removedSlugs: 1 }, lh: { upserted: 0 }, invalidated: 'per-slug' })
    const tags = calledTags()
    expect(tags).toContain('housing:lists')
    expect(tags).toContain(housingTag('h1'))
    expect(tags).toContain(housingTag('h3'))
    expect(tags).not.toContain('housing:all')
  })

  // 공고 동기화의 실패는 보조금24 결과를 가리지 않는다. 응답은 200이고 본문에 error가 실린다.
  it('소스 하나가 error면 그 사실을 싣고 전체를 비우되 200이다', async () => {
    housingMock.mockResolvedValue({ ...housingOk, lh: { ...housingOk.lh, error: 'lh 500' } })
    const res = await GET(housingReq())
    expect(res.status).toBe(200)
    expect((await res.json()).housing).toMatchObject({ lh: { error: 'lh 500' }, invalidated: 'all' })
    expect(calledTags()).toContain('housing:all')
  })

  it('runHousingSync 자체가 던지면 housing.error에 싣고 housing:all을 비운다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    housingMock.mockRejectedValue(new Error('boom'))
    const res = await GET(housingReq())
    expect(res.status).toBe(200)
    expect((await res.json()).housing).toMatchObject({ error: 'housing sync failed', invalidated: 'all' })
    expect(calledTags()).toContain('housing:all')
  })

  it('보조금24가 409로 중단되면 공고는 돌리지 않는다', async () => {
    runMock.mockResolvedValue({ ...quiet, aborted_reason: '건수 급감' })
    const res = await GET(housingReq())
    expect(res.status).toBe(409)
    expect(housingMock).not.toHaveBeenCalled()
  })

  // 시간 예산을 넘긴다
  it('공고 동기화에 시간 예산(deadlineMs)을 넘긴다', async () => {
    housingMock.mockResolvedValue(housingOk)
    const before = Date.now()
    await GET(housingReq())
    const deps = housingMock.mock.calls[0][0] as { deadlineMs?: number }
    expect(deps.deadlineMs).toBeGreaterThanOrEqual(before + 40_000)
    expect(deps.deadlineMs).toBeLessThanOrEqual(Date.now() + 60_000)
  })
})
