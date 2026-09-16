import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/server'
import { kstDateString } from './status'
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
  { tags: ['benefits:all'], revalidate: 21600 },
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
  { tags: ['benefits:all'], revalidate: 3600 },
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
  { tags: ['benefits:home'], revalidate: 3600 },
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
  { tags: ['benefits:home'], revalidate: 3600 },
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
  { tags: ['benefits:all'], revalidate: 3600 },
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
  { tags: ['benefits:all'], revalidate: 21600 },
)

export const getRegionMeta = unstable_cache(
  async (slug: string): Promise<{ code: string; slug: string; name: string; description_md: string | null } | null> => {
    const { data, error } = await createPublicClient().from('regions').select('code, slug, name, description_md').eq('slug', slug).maybeSingle()
    if (error) throw error
    return data
  },
  ['region-meta'],
  { tags: ['regions'], revalidate: 86400 },
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
  { tags: ['benefits:home'], revalidate: 600 },
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
  { tags: ['guides'], revalidate: 86400 },
)

export const getGuide = unstable_cache(
  async (slug: string): Promise<GuideRow | null> => {
    const { data, error } = await createPublicClient().from('guides').select('slug, title, body_md, segment, published_at').eq('slug', slug).maybeSingle()
    if (error) throw error
    return data
  },
  ['guide'],
  { tags: ['guides'], revalidate: 86400 },
)
