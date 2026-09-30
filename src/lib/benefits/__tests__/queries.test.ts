import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// unstable_cache는 테스트에서 그대로 통과시킨다
vi.mock('next/cache', () => ({ unstable_cache: (fn: (...a: unknown[]) => unknown) => fn }))

const chain = () => {
  const c: Record<string, unknown> = {}
  const self = () => c
  for (const m of ['select', 'eq', 'neq', 'in', 'contains', 'overlaps', 'gte', 'lte', 'gt', 'order', 'limit', 'range', 'not', 'is', 'ilike', 'or']) c[m] = vi.fn(self)
  c.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
  return c as Record<string, ReturnType<typeof vi.fn>>
}
const from = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createPublicClient: () => ({ from }) }))

import { getBenefitBySlug, listBySegment, listDeadlineSoon, getLastSyncAt, countByRegion, listWithArticles, listBrowse, countBrowseBySegment } from '../queries'
import { BROWSE_DEFAULTS } from '../browse'

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

  it('listBrowse는 필터를 모두 걸고 안정 정렬 뒤 페이지 범위로 자른다', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-10T03:00:00Z'))
    const c = chain()
    c.range.mockResolvedValue({ data: [{ slug: 'a', benefit_articles: { indexable: true } }], count: 41, error: null })
    from.mockReturnValue(c)
    const r = await listBrowse({ ...BROWSE_DEFAULTS, seg: 'small-biz', region: 'seoul', status: 'soon', explained: true, q: '창업 자금', page: 3 })
    expect(c.eq).toHaveBeenCalledWith('status', 'open')
    expect(c.contains).toHaveBeenCalledWith('segments', ['small_biz'])
    expect(c.in).toHaveBeenCalledWith('region_code', ['seoul', 'ALL'])
    expect(c.eq).toHaveBeenCalledWith('deadline_type', 'period')
    expect(c.gte).toHaveBeenCalledWith('apply_end', '2026-09-10')
    expect(c.lte).toHaveBeenCalledWith('apply_end', '2026-09-24')
    // '접수 중'이므로 아직 열리지 않은 공고는 뺀다
    expect(c.or).toHaveBeenCalledWith('apply_start.is.null,apply_start.lte.2026-09-10')
    expect(c.select.mock.calls[0][0]).toMatch(/benefit_articles!inner/)
    expect(c.eq).toHaveBeenCalledWith('benefit_articles.indexable', true)
    expect(c.ilike).toHaveBeenCalledWith('title', '%창업%')
    expect(c.ilike).toHaveBeenCalledWith('title', '%자금%')
    // 같은 마감일끼리 순서가 흔들리면 페이지 경계에서 카드가 겹치거나 빠진다
    expect(c.order).toHaveBeenLastCalledWith('slug', { ascending: true })
    expect(c.range).toHaveBeenCalledWith(40, 59)
    // 조인한 해설 열은 카드 행에 싣지 않는다
    expect(r).toEqual({ rows: [{ slug: 'a' }], total: 41 })
  })

  it('listBrowse 검색어는 진단 검색과 같은 낱말 수 상한에서 자른다', async () => {
    const c = chain()
    c.range.mockResolvedValue({ data: [], count: 0, error: null })
    from.mockReturnValue(c)
    await listBrowse({ ...BROWSE_DEFAULTS, q: '가 나 다 라 마 바 사' })
    expect(c.ilike.mock.calls.length).toBeLessThanOrEqual(4)
    expect(c.ilike.mock.calls.length).toBeGreaterThan(0)
  })

  it('listBrowse 전국 공통만은 ALL 하나만, 기본은 지역·해설 조인 없음', async () => {
    const c = chain()
    c.range.mockResolvedValue({ data: [], count: 0, error: null })
    from.mockReturnValue(c)
    await listBrowse({ ...BROWSE_DEFAULTS, region: 'national' })
    expect(c.eq).toHaveBeenCalledWith('region_code', 'ALL')
    expect(c.in).not.toHaveBeenCalled()
    expect(c.select.mock.calls[0][0]).not.toMatch(/benefit_articles/)
    expect(c.order).toHaveBeenCalledWith('apply_end', { ascending: true, nullsFirst: false })
  })

  it('listBrowse 새로 등록순은 created_at 내림차순, 동률은 slug로 고정', async () => {
    const c = chain()
    c.range.mockResolvedValue({ data: [], count: 0, error: null })
    from.mockReturnValue(c)
    await listBrowse({ ...BROWSE_DEFAULTS, sort: 'new' })
    expect(c.order).toHaveBeenNthCalledWith(1, 'created_at', { ascending: false })
    expect(c.order).toHaveBeenLastCalledWith('slug', { ascending: true })
  })

  it('listBrowse는 범위 밖 페이지(PGRST103)를 오류로 보지 않고 건수만 돌려준다', async () => {
    const c = chain()
    c.range.mockResolvedValue({ data: null, count: null, error: { code: 'PGRST103', message: 'Requested range not satisfiable' } })
    ;(c as unknown as { then: unknown }).then = (res: (v: unknown) => void) => res({ count: 41, error: null })
    from.mockReturnValue(c)
    expect(await listBrowse({ ...BROWSE_DEFAULTS, page: 99 })).toEqual({ rows: [], total: 41 })
  })

  it('countBrowseBySegment는 분야마다 같은 필터로 센다', async () => {
    const c = chain()
    // head 요청은 마지막 필터 호출이 await된다. 체인 자체를 thenable로 만들어 count를 돌려준다.
    ;(c as unknown as { then: unknown }).then = (res: (v: unknown) => void) => res({ count: 5, error: null })
    from.mockReturnValue(c)
    const r = await countBrowseBySegment({ ...BROWSE_DEFAULTS, seg: 'youth', status: 'always' })
    expect(r.all).toBe(5)
    expect(Object.keys(r.bySeg)).toEqual(['youth', 'parenting', 'small-biz', 'other'])
    expect(c.eq).toHaveBeenCalledWith('deadline_type', 'always')
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

    it('segment가 null이면 사이트맵 세그먼트로 한정한다 — 사이트맵에 없는 페이지를 링크하지 않도록', async () => {
      // 세그먼트 사이트맵은 SITEMAP_SEGMENTS(공개 3 + 기타)를 낸다. 무필터로 두면 빈 segments
      // 지원금을 홈에서만 링크하게 되어 어느 사이트맵에도 없는 페이지가 색인 대상이 된다.
      const c = chain()
      c.limit.mockResolvedValue({ data: [], error: null })
      from.mockReturnValue(c)
      await listWithArticles(null)
      expect(c.overlaps).toHaveBeenCalledWith('benefits.segments', ['youth', 'parenting', 'small_biz', 'other'])
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
