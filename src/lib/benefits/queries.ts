import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/server'
import { kstDateString } from './status'
import { benefitIndexable, INDEXABLE_REVIEW_STATUSES } from '@/lib/seo/index-policy'
import { PUBLIC_SEGMENTS } from '../../../data/segments'
import { CACHE_TAGS } from '@/lib/cache-tags'
import type { BenefitStatus, DeadlineType, Gender, ReviewStatus, Segment } from '@/types/database'

export interface BenefitListRow {
  slug: string
  title: string
  summary: string | null
  amount_text: string | null
  deadline_type: DeadlineType
  apply_start: string | null
  apply_end: string | null
  region_code: string
  segments: Segment[]
  agency: string | null
  synced_at: string
}

export interface ConditionJoin {
  age_min: number | null
  age_max: number | null
  gender: Gender
  income_bands: string[]
  life_stages: string[]
  household_types: string[]
  occupations: string[]
  region_codes: string[]
}

export interface ArticleJoin {
  explainer_md: string | null
  steps_md: string | null
  faq_json: { q: string; a: string }[]
  checklist_json: { label: string; condition_key: string }[]
  related_ids: string[]
  review_status: ReviewStatus
  indexable: boolean
  reviewed_at: string | null
}

export interface BenefitDetail extends BenefitListRow {
  id: string
  target_text: string | null
  criteria_text: string | null
  apply_method: string | null
  apply_url: string | null
  contact: string | null
  status: BenefitStatus
  source_updated_at: string | null
  benefit_conditions: ConditionJoin | null
  benefit_articles: ArticleJoin | null
}

const ROWS_PER_PAGE = 1000 // Supabase 단일 응답 기본 최대 행 수

const LIST_COLS = 'slug, title, summary, amount_text, deadline_type, apply_start, apply_end, region_code, segments, agency, synced_at'
const DETAIL_COLS = `id, ${LIST_COLS}, target_text, criteria_text, apply_method, apply_url, contact, status, source_updated_at,
  benefit_conditions(age_min, age_max, gender, income_bands, life_stages, household_types, occupations, region_codes),
  benefit_articles(explainer_md, steps_md, faq_json, checklist_json, related_ids, review_status, indexable, reviewed_at)`

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export const getBenefitBySlug = unstable_cache(
  async (slug: string): Promise<BenefitDetail | null> => {
    const { data, error } = await createPublicClient().from('benefits').select(DETAIL_COLS).eq('slug', slug).maybeSingle()
    if (error) throw error
    if (!data) return null
    const d = data as unknown as BenefitDetail & { benefit_conditions: ConditionJoin | ConditionJoin[] | null; benefit_articles: ArticleJoin | ArticleJoin[] | null }
    return { ...d, benefit_conditions: one(d.benefit_conditions), benefit_articles: one(d.benefit_articles) }
  },
  ['benefit-by-slug'],
  { tags: [CACHE_TAGS.benefitsAll], revalidate: 21600 },
)

export interface ListOptions {
  region?: string | null
  limit?: number
  /** true면 region_code가 정확히 region인 것만. false/미지정이면 전국(ALL)도 함께 본다. */
  regionOnly?: boolean
}

export const listBySegment = unstable_cache(
  async (segment: Segment, opts: ListOptions): Promise<BenefitListRow[]> => {
    let q = createPublicClient().from('benefits').select(LIST_COLS).eq('status', 'open').contains('segments', [segment])
    if (opts.region) q = opts.regionOnly ? q.eq('region_code', opts.region) : q.in('region_code', [opts.region, 'ALL'])
    const { data, error } = await q.order('apply_end', { ascending: true, nullsFirst: false }).limit(opts.limit ?? 50)
    if (error) throw error
    return (data ?? []) as unknown as BenefitListRow[]
  },
  ['list-by-segment'],
  { tags: [CACHE_TAGS.benefitsAll], revalidate: 3600 },
)

/**
 * 해설이 붙어 색인 대상이 된 지원금.
 *
 * 허브의 "마감 임박 순" 목록과는 다른 축이다. 해설을 쓴 제도는 대부분 상시 접수라
 * apply_end가 null이고, listBySegment는 nullsFirst:false로 정렬하므로 이들이 855건 중
 * 맨 끝으로 밀려 목록에 영영 나오지 않는다. 그 결과 사이트에서 본문이 가장 충실한 페이지가
 * 내부 링크 0인 고아 페이지가 되고, 검색엔진은 사이트맵으로 찾아와도 색인을 미룬다
 * (실제로 Search Console에 "크롤링됨 - 현재 색인이 생성되지 않음"으로 잡혔다).
 *
 * benefits가 아니라 benefit_articles를 부모로 조회한다. 정렬 기준인 reviewed_at이 해설 쪽
 * 열이라 benefits를 부모로 두면 SQL로 정렬할 수 없고, 그러면 LIMIT이 임의의 행을 자른 뒤
 * JS에서 정렬하게 된다 — 초안이 쌓이면 발행분이 통째로 잘려 이 섹션이 조용히 비고,
 * 고치려던 고아 페이지 문제가 오류 하나 없이 그대로 돌아온다. review_status는 기본값이
 * draft이고 초안 생성이 자동화되어 있으므로 초안이 다수가 되는 것이 정상 상태다.
 *
 * 색인 기준은 index-policy가 단독으로 정한다. SQL 필터는 그 상수를 그대로 넘기고,
 * benefitIndexable을 뒤에서 한 번 더 통과시켜 기준이 갈라질 여지를 남기지 않는다.
 * 기준이 갈라지면 사이트맵에 없는 페이지로 링크가 가거나(색인 낭비) 그 반대가 된다.
 *
 * @param segment null이면 공개 세그먼트 전체(홈용). 공개 세그먼트로 한정하는 이유는
 *   세그먼트 사이트맵이 PUBLIC_SEGMENTS만 내기 때문이다. 'other'나 빈 segments를 가진
 *   지원금을 홈에서 링크하면 어느 사이트맵에도 없는 페이지를 홈에서만 가리키게 된다.
 */
export const listWithArticles = unstable_cache(
  async (segment: Segment | null, limit = 12): Promise<BenefitListRow[]> => {
    let q = createPublicClient()
      .from('benefit_articles')
      // status는 benefitIndexable이 다시 보므로 함께 읽는다
      .select(`review_status, indexable, benefits!inner(${LIST_COLS}, status)`)
      .eq('indexable', true)
      .in('review_status', INDEXABLE_REVIEW_STATUSES as unknown as string[])
      .eq('benefits.status', 'open')
    q = segment
      ? q.contains('benefits.segments', [segment])
      : q.overlaps('benefits.segments', PUBLIC_SEGMENTS.map((s) => s.slug))
    const { data, error } = await q
      // 최근 검수 순. 동률일 때 순서가 재생성마다 뒤집히지 않도록 PK로 한 번 더 고정한다.
      .order('reviewed_at', { ascending: false, nullsFirst: false })
      .order('benefit_id', { ascending: true })
      .limit(limit)
    if (error) throw error
    type Row = { review_status: ReviewStatus; indexable: boolean; benefits: Parent | Parent[] | null }
    type Parent = BenefitListRow & { status: BenefitStatus }
    const out: BenefitListRow[] = []
    for (const r of (data ?? []) as unknown as Row[]) {
      const b = one(r.benefits)
      if (b && benefitIndexable({ status: b.status, article: { review_status: r.review_status, indexable: r.indexable } })) out.push(b)
    }
    return out
  },
  ['list-with-articles'],
  { tags: [CACHE_TAGS.benefitsAll], revalidate: 3600 },
)

export const listDeadlineSoon = unstable_cache(
  // '오늘'을 인자로 받지 않고 안에서 읽는다. unstable_cache는 인자까지 키에 넣으므로 호출부가
  // 요청마다 new Date()를 넘기면 키가 매번 달라져 캐시가 사실상 꺼진다(적중률 0, 항목 무한 증가).
  // 안에서 읽으면 키는 [days, limit]으로 안정되고, '오늘' 경계는 revalidate 범위만큼만 늦어진다.
  // 테스트는 vitest의 fakeTimers(toFake: ['Date'])로 vi.setSystemTime을 써서 고정한다.
  async (days: number, limit = 8): Promise<BenefitListRow[]> => {
    const now = new Date()
    const from = kstDateString(now)
    const to = kstDateString(new Date(now.getTime() + days * 86_400_000))
    const { data, error } = await createPublicClient()
      .from('benefits')
      .select(LIST_COLS)
      .eq('status', 'open')
      .eq('deadline_type', 'period')
      .gte('apply_end', from)
      .lte('apply_end', to)
      .order('apply_end', { ascending: true })
      .limit(limit)
    if (error) throw error
    return (data ?? []) as unknown as BenefitListRow[]
  },
  ['deadline-soon'],
  { tags: [CACHE_TAGS.benefitsHome], revalidate: 3600 },
)

export const listRecentlyUpdated = unstable_cache(
  // listDeadlineSoon과 같은 이유로 현재 시각을 인자로 받지 않는다.
  async (hours: number, limit = 8): Promise<BenefitListRow[]> => {
    const since = new Date(Date.now() - hours * 3_600_000).toISOString()
    const { data, error } = await createPublicClient()
      .from('benefits')
      .select(LIST_COLS)
      .eq('status', 'open')
      .gte('source_updated_at', since)
      .order('source_updated_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []) as unknown as BenefitListRow[]
  },
  ['recently-updated'],
  { tags: [CACHE_TAGS.benefitsHome], revalidate: 3600 },
)

export const countByRegion = unstable_cache(
  async (segment: Segment): Promise<Record<string, number>> => {
    // Supabase는 한 응답에 최대 1000행만 준다. 세그먼트 하나가 1000건을 넘으면(출산/육아는 3천 건대)
    // 페이징 없이는 집계가 조용히 축소되므로 반드시 range로 끝까지 돌린다. 커서 없는 range는
    // 정렬이 없으면 페이지가 겹치거나 빠질 수 있어 기본키로 안정 정렬을 건다.
    const supabase = createPublicClient()
    const counts: Record<string, number> = {}
    for (let offset = 0; ; offset += ROWS_PER_PAGE) {
      const { data, error } = await supabase
        .from('benefits')
        .select('region_code')
        .eq('status', 'open')
        .contains('segments', [segment])
        .order('id', { ascending: true })
        .range(offset, offset + ROWS_PER_PAGE - 1)
      if (error) throw error
      const rows = (data ?? []) as { region_code: string }[]
      for (const r of rows) counts[r.region_code] = (counts[r.region_code] ?? 0) + 1
      if (rows.length < ROWS_PER_PAGE) break
    }
    return counts
  },
  ['count-by-region'],
  { tags: [CACHE_TAGS.benefitsAll], revalidate: 3600 },
)

export const listRelated = unstable_cache(
  async (segment: Segment, region: string, excludeSlug: string, limit = 6): Promise<BenefitListRow[]> => {
    const { data, error } = await createPublicClient()
      .from('benefits')
      .select(LIST_COLS)
      .eq('status', 'open')
      .contains('segments', [segment])
      .in('region_code', [region, 'ALL'])
      .neq('slug', excludeSlug)
      .order('apply_end', { ascending: true, nullsFirst: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []) as unknown as BenefitListRow[]
  },
  ['related'],
  { tags: [CACHE_TAGS.benefitsAll], revalidate: 21600 },
)

export const getRegionMeta = unstable_cache(
  async (slug: string): Promise<{ code: string; slug: string; name: string; description_md: string | null } | null> => {
    const { data, error } = await createPublicClient().from('regions').select('code, slug, name, description_md').eq('slug', slug).maybeSingle()
    if (error) throw error
    return data
  },
  ['region-meta'],
  { tags: [CACHE_TAGS.regions], revalidate: 86400 },
)

export const getLastSyncAt = unstable_cache(
  async (): Promise<string | null> => {
    const { data, error } = await createPublicClient()
      .from('sync_runs')
      .select('finished_at')
      .is('error', null)
      .is('aborted_reason', null)
      // 진행 중인 동기화 행도 error·aborted_reason이 null이라 정렬 1위를 차지한다. finished_at을
      // 요구하지 않으면 동기화가 도는 동안 홈의 '마지막 확인' 줄이 비고, revalidate(600s) 때문에
      // 동기화가 끝난 뒤에도 최대 10분 더 빈 채로 남는다.
      .not('finished_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data?.finished_at ?? null
  },
  ['last-sync'],
  { tags: [CACHE_TAGS.benefitsHome], revalidate: 600 },
)

export interface GuideRow {
  slug: string
  title: string
  body_md: string
  segment: string | null
  published_at: string | null
}

/** 사이트맵용 발행 가이드 목록. 색인 판정은 넘겨받는 쪽(guideEntries)이 한다. */
export const listPublishedGuides = unstable_cache(
  async (): Promise<{ slug: string; published_at: string | null }[]> => {
    const { data, error } = await createPublicClient()
      .from('guides')
      .select('slug, published_at')
      .not('published_at', 'is', null)
      .order('slug')
    if (error) throw error
    return data ?? []
  },
  ['guides-published'],
  { tags: [CACHE_TAGS.guides], revalidate: 86400 },
)

export interface GuideListRow {
  slug: string
  title: string
  segment: string | null
  published_at: string
}

/**
 * 목록 페이지용 발행 가이드.
 *
 * listPublishedGuides(사이트맵용)는 slug와 published_at만 뽑는다. 목록에는 제목과 분야가
 * 필요해 별도로 둔다 — 사이트맵 쿼리에 컬럼을 더하면 1만 건 규모 사이트맵이 매번 쓰지도
 * 않는 본문 인접 컬럼을 끌어온다.
 *
 * 최신순이다. published_at이 같은 날짜에 몰리면 순서가 요청마다 흔들려 목록이 이유 없이
 * 재배열되므로 slug로 한 번 더 고정한다.
 */
export const listGuides = unstable_cache(
  async (): Promise<GuideListRow[]> => {
    const { data, error } = await createPublicClient()
      .from('guides')
      .select('slug, title, segment, published_at')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .order('slug', { ascending: true })
    if (error) throw error
    return (data ?? []) as GuideListRow[]
  },
  ['guides-list'],
  { tags: [CACHE_TAGS.guides], revalidate: 86400 },
)

export const getGuide = unstable_cache(
  async (slug: string): Promise<GuideRow | null> => {
    const { data, error } = await createPublicClient().from('guides').select('slug, title, body_md, segment, published_at').eq('slug', slug).maybeSingle()
    if (error) throw error
    return data
  },
  ['guide'],
  { tags: [CACHE_TAGS.guides], revalidate: 86400 },
)
