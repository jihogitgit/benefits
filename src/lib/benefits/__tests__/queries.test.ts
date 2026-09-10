import { describe, it, expect, vi, beforeEach } from 'vitest'

// unstable_cache는 테스트에서 그대로 통과시킨다
vi.mock('next/cache', () => ({ unstable_cache: (fn: (...a: unknown[]) => unknown) => fn }))

const chain = () => {
  const c: Record<string, unknown> = {}
  const self = () => c
  for (const m of ['select', 'eq', 'neq', 'in', 'contains', 'gte', 'lte', 'gt', 'order', 'limit', 'range', 'not', 'is']) c[m] = vi.fn(self)
  c.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
  return c as Record<string, ReturnType<typeof vi.fn>>
}
const from = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createPublicClient: () => ({ from }) }))

import { getBenefitBySlug, listBySegment, listDeadlineSoon, countByRegion } from '../queries'

describe('queries', () => {
  beforeEach(() => from.mockReset())

  it('getBenefitBySlug는 조건·해설을 함께 조인하고 없으면 null', async () => {
    const c = chain()
    c.maybeSingle.mockResolvedValue({ data: { slug: 'a', title: 'T', benefit_conditions: null, benefit_articles: null }, error: null })
    from.mockReturnValue(c)
    const b = await getBenefitBySlug('a')
    expect(from).toHaveBeenCalledWith('benefits')
    expect(c.select.mock.calls[0][0]).toMatch(/benefit_conditions\(/)
    expect(c.select.mock.calls[0][0]).toMatch(/benefit_articles\(/)
    expect(c.eq).toHaveBeenCalledWith('slug', 'a')
    expect(b?.title).toBe('T')

    c.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await getBenefitBySlug('zzz')).toBeNull()
  })

  it('listBySegment는 open + 세그먼트 포함 + 지역(선택) 필터', async () => {
    const c = chain()
    c.limit.mockResolvedValue({ data: [{ slug: 'x' }], error: null })
    from.mockReturnValue(c)
    const rows = await listBySegment('youth', { region: 'seoul', limit: 20 })
    expect(c.eq).toHaveBeenCalledWith('status', 'open')
    expect(c.contains).toHaveBeenCalledWith('segments', ['youth'])
    expect(c.in).toHaveBeenCalledWith('region_code', ['seoul', 'ALL'])
    expect(rows).toEqual([{ slug: 'x' }])
  })

  it('listDeadlineSoon은 오늘~N일 사이 기간 항목만', async () => {
    const c = chain()
    c.limit.mockResolvedValue({ data: [], error: null })
    from.mockReturnValue(c)
    await listDeadlineSoon(14, new Date('2026-09-10T03:00:00Z'))
    expect(c.eq).toHaveBeenCalledWith('deadline_type', 'period')
    expect(c.gte).toHaveBeenCalledWith('apply_end', '2026-09-10')
    expect(c.lte).toHaveBeenCalledWith('apply_end', '2026-09-24')
  })

  it('countByRegion은 region_code별 건수를 집계한다', async () => {
    const c = chain()
    c.contains.mockResolvedValue({ data: [{ region_code: 'seoul' }, { region_code: 'seoul' }, { region_code: 'ALL' }], error: null })
    from.mockReturnValue(c)
    const counts = await countByRegion('youth')
    expect(counts).toEqual({ seoul: 2, ALL: 1 })
  })

  it('오류는 throw', async () => {
    const c = chain()
    c.limit.mockResolvedValue({ data: null, error: { message: 'boom' } })
    from.mockReturnValue(c)
    await expect(listBySegment('youth', {})).rejects.toBeTruthy()
  })
})
