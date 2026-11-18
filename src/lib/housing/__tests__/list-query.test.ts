import { beforeEach, describe, expect, it, vi } from 'vitest'

// 캐시는 통과시키고, Supabase 빌더는 호출을 기록하는 가짜로 바꾼다. 조회 조건과 결과 가공(상태 재판정·정렬)을 본다.
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
const calls: [string, ...unknown[]][] = []
let data: Record<string, unknown>[] = []
vi.mock('@/lib/supabase/server', () => ({
  createPublicClient: () => {
    const b: Record<string, unknown> = {}
    for (const m of ['from', 'select', 'in', 'eq', 'or', 'order', 'range']) b[m] = (...a: unknown[]) => (calls.push([m, ...a]), b)
    b.limit = (...a: unknown[]) => (calls.push(['limit', ...a]), Promise.resolve({ data, error: null }))
    return b
  },
}))

import { listHousing, HOUSING_LIST_LIMIT } from '../queries'

const row = (slug: string, status: string, receipt_start: string | null, receipt_end: string | null) => ({
  slug, title: slug, source: 'applyhome', kind: 'apt', kind_detail: null, region_code: 'seoul', status, receipt_start, receipt_end,
  total_units: null, sp_newlywed_units: 0, sp_first_life_units: 0, sp_multi_child_units: 0, detail_url: null,
})
const orArgs = () => calls.filter((c) => c[0] === 'or').map((c) => c[1])

beforeEach(() => {
  calls.length = 0
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-18T01:00:00Z')) // 2026-11-18 10:00 KST
  return () => vi.useRealTimers()
})

describe('listHousing', () => {
  it('접수중·예정 목록은 접수 일자가 지난 공고를 DB 조건으로 뺀다', async () => {
    data = []
    await listHousing({ status: 'active', kind: null, region: null, limit: 4 })
    expect(orArgs()).toEqual(['receipt_end.is.null,receipt_end.gte.2026-11-18'])
    // 접수중이 먼저여야 하므로 전부 받은 뒤 자른다
    expect(calls.find((c) => c[0] === 'limit')?.[1]).toBe(HOUSING_LIST_LIMIT)
  })

  it('마감 목록은 상태가 아직 접수중이어도 일자가 지난 공고를 포함한다', async () => {
    data = [row('stale', 'open', '2026-11-09', '2026-11-11')]
    const out = await listHousing({ status: 'closed', kind: null, region: null, limit: 500 })
    expect(orArgs()).toEqual(['status.eq.closed,and(status.in.(open,upcoming),receipt_end.lt.2026-11-18)'])
    expect(out[0].status).toBe('closed')
  })

  it('상태를 오늘 날짜로 다시 세고, 접수중을 예정보다 먼저 낸 뒤 limit만큼 자른다', async () => {
    data = [
      row('soon-end-but-upcoming', 'upcoming', '2026-11-19', '2026-11-20'),
      row('started-today', 'upcoming', '2026-11-18', '2026-11-25'), // DB는 예정, 오늘 접수 시작
      row('open-late', 'open', '2026-11-10', '2026-11-30'),
    ]
    const out = await listHousing({ status: 'active', kind: null, region: null, limit: 2 })
    expect(out.map((r) => [r.slug, r.status])).toEqual([['started-today', 'open'], ['open-late', 'open']])
  })
})
