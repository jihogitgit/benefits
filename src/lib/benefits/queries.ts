import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/server'
import { kstDateString } from './status'
import type { Segment } from '@/types/database'

export interface BenefitListRow {
  slug: string
  title: string
  summary: string | null
  amount_text: string | null
  deadline_type: string
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
  gender: string
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
  review_status: string
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
  status: string
  source_updated_at: string | null
  benefit_conditions: ConditionJoin | null
  benefit_articles: ArticleJoin | null
}

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
}

export const listBySegment = unstable_cache(
  async (segment: Segment, opts: ListOptions): Promise<BenefitListRow[]> => {
    let q = createPublicClient().from('benefits').select(LIST_COLS).eq('status', 'open').contains('segments', [segment])
    if (opts.region) q = q.in('region_code', [opts.region, 'ALL'])
    const { data, error } = await q.order('apply_end', { ascending: true, nullsFirst: false }).limit(opts.limit ?? 50)
    if (error) throw error
    return (data ?? []) as unknown as BenefitListRow[]
  },
  ['list-by-segment'],
  { tags: ['benefits:all'], revalidate: 3600 },
)

export const listDeadlineSoon = unstable_cache(
  async (days: number, now: Date = new Date(), limit = 8): Promise<BenefitListRow[]> => {
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
  async (hours: number, now: Date = new Date(), limit = 8): Promise<BenefitListRow[]> => {
    const since = new Date(now.getTime() - hours * 3_600_000).toISOString()
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
    const { data, error } = await createPublicClient().from('benefits').select('region_code').eq('status', 'open').contains('segments', [segment])
    if (error) throw error
    const counts: Record<string, number> = {}
    for (const r of (data ?? []) as { region_code: string }[]) counts[r.region_code] = (counts[r.region_code] ?? 0) + 1
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
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data?.finished_at ?? null
  },
  ['last-sync'],
  { tags: ['benefits:home'], revalidate: 600 },
)
