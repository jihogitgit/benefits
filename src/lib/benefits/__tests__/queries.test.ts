import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// unstable_cache는 테스트에서 그대로 통과시킨다
vi.mock('next/cache', () => ({ unstable_cache: (fn: (...a: unknown[]) => unknown) => fn }))

const chain = () => {
  const c: Record<string, unknown> = {}
  const self = () => c
  for (const m of ['select', 'eq', 'neq', 'in', 'contains', 'overlaps', 'gte', 'lte', 'gt', 'order', 'limit', 'range', 'not', 'is']) c[m] = vi.fn(self)
  c.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
  return c as Record<string, ReturnType<typeof vi.fn>>
}
const from = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createPublicClient: () => ({ from }) }))

import { getBenefitBySlug, listBySegment, listDeadlineSoon, getLastSyncAt, countByRegion, listWithArticles } from '../queries'

describe('queries', () => {
  beforeEach(() => from.mockReset())
  afterEach(() => vi.useRealTimers())

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
    // 캐시 키를 안정시키려고 현재 시각을 인자로 받지 않으므로 시스템 시각을 고정해서 검증한다.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-10T03:00:00Z'))
    const c = chain()
    c.limit.mockResolvedValue({ data: [], error: null })
    from.mockReturnValue(c)
    await listDeadlineSoon(14)
    expect(c.eq).toHaveBeenCalledWith('deadline_type', 'period')
    expect(c.gte).toHaveBeenCalledWith('apply_end', '2026-09-10')
    expect(c.lte).toHaveBeenCalledWith('apply_end', '2026-09-24')
  })

  it('getLastSyncAt은 진행 중인 동기화 행을 제외한다', async () => {
    const c = chain()
    c.maybeSingle.mockResolvedValue({ data: { finished_at: '2026-09-10T03:00:00+00:00' }, error: null })
    from.mockReturnValue(c)
    expect(await getLastSyncAt()).toBe('2026-09-10T03:00:00+00:00')
    expect(c.not).toHaveBeenCalledWith('finished_at', 'is', null)
  })

  it('countByRegion은 region_code별 건수를 집계한다', async () => {
    const c = chain()
    c.range.mockResolvedValue({ data: [{ region_code: 'seoul' }, { region_code: 'seoul' }, { region_code: 'ALL' }], error: null })
    from.mockReturnValue(c)
    const counts = await countByRegion('youth')
    expect(counts).toEqual({ seoul: 2, ALL: 1 })
    expect(c.range).toHaveBeenCalledTimes(1)
    expect(c.range).toHaveBeenCalledWith(0, 999)
  })

  it('countByRegion은 1000행 상한을 넘으면 다음 페이지까지 집계한다', async () => {
    const c = chain()
    const full = Array.from({ length: 1000 }, () => ({ region_code: 'seoul' }))
    c.range
      .mockResolvedValueOnce({ data: full, error: null })
      .mockResolvedValueOnce({ data: [{ region_code: 'busan' }], error: null })
    from.mockReturnValue(c)
    const counts = await countByRegion('parenting')
    expect(counts).toEqual({ seoul: 1000, busan: 1 })
    expect(c.range).toHaveBeenNthCalledWith(1, 0, 999)
    expect(c.range).toHaveBeenNthCalledWith(2, 1000, 1999)
  })

  it('오류는 throw', async () => {
    const c = chain()
    c.limit.mockResolvedValue({ data: null, error: { message: 'boom' } })
    from.mockReturnValue(c)
    await expect(listBySegment('youth', {})).rejects.toBeTruthy()
  })

  describe('listWithArticles', () => {
    const row = (slug: string, over: Record<string, unknown> = {}) => ({
      review_status: 'published',
      indexable: true,
      benefits: { slug, status: 'open', title: slug },
      ...over,
    })

    it('색인 조건을 SQL로 거른다 — LIMIT이 색인 대상 집합에만 걸려야 한다', async () => {
      // 초안이 다수가 되는 것이 정상 상태(review_status 기본값 draft)다. 판정을 JS에서만 하면
      // DB가 초안까지 포함해 자른 뒤 걸러내게 되어 발행분이 조용히 사라진다.
      const c = chain()
      c.limit.mockResolvedValue({ data: [], error: null })
      from.mockReturnValue(c)
      await listWithArticles('youth', 8)
      expect(from).toHaveBeenCalledWith('benefit_articles')
      expect(c.eq).toHaveBeenCalledWith('indexable', true)
      expect(c.in).toHaveBeenCalledWith('review_status', ['published', 'stale'])
      expect(c.eq).toHaveBeenCalledWith('benefits.status', 'open')
      // limit은 걸러낸 뒤가 아니라 DB에 그대로 내려가야 한다
      expect(c.limit).toHaveBeenCalledWith(8)
    })

    it('최근 검수 순으로 SQL 정렬하고, 동률은 PK로 고정한다', async () => {
      const c = chain()
      c.limit.mockResolvedValue({ data: [], error: null })
      from.mockReturnValue(c)
      await listWithArticles('youth')
      expect(c.order).toHaveBeenCalledWith('reviewed_at', { ascending: false, nullsFirst: false })
      // 동률 시 재생성마다 순서가 뒤집히지 않게 하는 결정성 보장
      expect(c.order).toHaveBeenCalledWith('benefit_id', { ascending: true })
    })

    it('segment가 null이면 공개 세그먼트로만 한정한다 — 사이트맵에 없는 페이지를 링크하지 않도록', async () => {
      // 세그먼트 사이트맵은 PUBLIC_SEGMENTS만 낸다. 무필터로 두면 'other'나 빈 segments 지원금을
      // 홈에서만 링크하게 되어 어느 사이트맵에도 없는 페이지가 색인 대상이 된다.
      const c = chain()
      c.limit.mockResolvedValue({ data: [], error: null })
      from.mockReturnValue(c)
      await listWithArticles(null)
      expect(c.overlaps).toHaveBeenCalledWith('benefits.segments', ['youth', 'parenting', 'small_biz'])
      expect(c.contains).not.toHaveBeenCalled()

      const c2 = chain()
      c2.limit.mockResolvedValue({ data: [], error: null })
      from.mockReturnValue(c2)
      await listWithArticles('parenting')
      expect(c2.contains).toHaveBeenCalledWith('benefits.segments', ['parenting'])
      expect(c2.overlaps).not.toHaveBeenCalled()
    })

    it('benefitIndexable을 뒤에서 한 번 더 통과시킨다 (SQL 필터와 기준이 갈라지는 것 방지)', async () => {
      const c = chain()
      c.limit.mockResolvedValue({
        data: [
          row('ok'),
          row('stale-ok', { review_status: 'stale' }),
          // SQL 필터가 못 거른 경우를 가정한다 — 판정은 index-policy가 단독으로 한다
          row('closed', { benefits: { slug: 'closed', status: 'closed', title: 'closed' } }),
          row('draft', { review_status: 'draft' }),
          { review_status: 'published', indexable: true, benefits: null },
        ],
        error: null,
      })
      from.mockReturnValue(c)
      expect((await listWithArticles('youth')).map((r) => r.slug)).toEqual(['ok', 'stale-ok'])
    })

    it('부모 행을 그대로 펴서 돌려주고, DB가 준 순서를 유지한다', async () => {
      const c = chain()
      c.limit.mockResolvedValue({ data: [row('b'), row('a'), row('c')], error: null })
      from.mockReturnValue(c)
      const rows = await listWithArticles(null, 3)
      // 정렬은 SQL이 이미 했다. JS에서 다시 정렬하면 잘린 표본만 정렬하는 꼴이 된다.
      expect(rows.map((r) => r.slug)).toEqual(['b', 'a', 'c'])
      expect(rows[0]).toMatchObject({ slug: 'b', title: 'b' })
    })

    it('Supabase 오류는 삼키지 않고 그대로 올린다', async () => {
      const c = chain()
      c.limit.mockResolvedValue({ data: null, error: new Error('boom') })
      from.mockReturnValue(c)
      await expect(listWithArticles('youth')).rejects.toThrow('boom')
    })
  })
})
