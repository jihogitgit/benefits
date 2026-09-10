import type { SupabaseClient } from '@supabase/supabase-js'
import { SITUATION_TO_CONDITIONS } from '@/lib/conditions/codemap'
import { REGIONS } from '../../../data/regions'
import { daysUntil } from './status'

export const AGE_BANDS = ['10s', '20s', '30s', '40s', '50s+'] as const
export type AgeBand = (typeof AGE_BANDS)[number]
const SITUATIONS = Object.keys(SITUATION_TO_CONDITIONS)
const REGION_SLUGS = new Set(REGIONS.map((r) => r.slug))

export interface SearchInput {
  ageBand: AgeBand | null
  situations: string[]
  region: string | null
  countOnly: boolean
  limit: number
  offset: number
}

/** 쿼리스트링을 검증된 검색 입력으로. 허용 목록에 없는 값은 버린다. */
export function parseSearchParams(sp: URLSearchParams): SearchInput {
  const age = sp.get('age')
  const region = sp.get('region')
  return {
    ageBand: AGE_BANDS.includes(age as AgeBand) ? (age as AgeBand) : null,
    situations: (sp.get('situations') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => SITUATIONS.includes(s)),
    region: region && REGION_SLUGS.has(region) ? region : null,
    countOnly: sp.get('count') === '1',
    limit: Math.min(100, Math.max(1, Number(sp.get('limit') ?? 50) || 50)),
    offset: Math.max(0, Number(sp.get('offset') ?? 0) || 0),
  }
}

export function ageBandToRange(band: AgeBand | null): [number, number] | null {
  if (!band) return null
  if (band === '50s+') return [50, 120]
  const start = Number(band.slice(0, 2))
  return [start, start + 9]
}

export interface CondLike {
  age_min: number | null
  age_max: number | null
  gender: 'any' | 'male' | 'female'
  life_stages: string[]
  household_types: string[]
  occupations: string[]
  region_codes: string[]
}

export interface Criteria {
  ageRange: [number, number] | null
  situations: string[]
  region: string | null
}

/**
 * 조건 행이 입력 조건에 맞는지. 조건이 비어 있는 축은 거르지 않는다(전국·전연령·상황무관).
 * 상황은 하나라도 일치하면 통과.
 */
export function matchesConditions(c: CondLike, q: Criteria): boolean {
  if (q.ageRange && c.age_min !== null && c.age_max !== null) {
    if (c.age_max < q.ageRange[0] || c.age_min > q.ageRange[1]) return false
  }
  if (q.region && c.region_codes.length > 0 && !c.region_codes.includes(q.region)) return false
  if (q.situations.length > 0) {
    const hasAnySituationCond = c.life_stages.length + c.household_types.length + c.occupations.length > 0
    if (hasAnySituationCond) {
      const wanted = q.situations.map((s) => SITUATION_TO_CONDITIONS[s]).filter(Boolean)
      const hit = wanted.some(
        (w) =>
          (w.life ?? []).some((v) => c.life_stages.includes(v)) ||
          (w.household ?? []).some((v) => c.household_types.includes(v)) ||
          (w.occupation ?? []).some((v) => c.occupations.includes(v)),
      )
      if (!hit) return false
    }
  }
  return true
}

export interface Rankable {
  slug: string
  deadline_type: string
  apply_end: string | null
  hasConditions: boolean
}

/** 마감 임박(기간) → 상시/미확정 → 조건 확인 필요 순. 같은 그룹 안은 D-day 오름차순, 그 외 slug 순. */
export function rankBenefits<T extends Rankable>(rows: T[], now: Date): T[] {
  const group = (r: Rankable) => (!r.hasConditions ? 2 : r.deadline_type === 'period' && r.apply_end ? 0 : 1)
  return [...rows].sort((a, b) => {
    const g = group(a) - group(b)
    if (g !== 0) return g
    if (group(a) === 0) return (daysUntil(a.apply_end, now) ?? 0) - (daysUntil(b.apply_end, now) ?? 0)
    return a.slug.localeCompare(b.slug)
  })
}

export function cacheKeyFor(input: SearchInput): string {
  return [
    input.ageBand ?? '-',
    [...input.situations].sort().join('+') || '-',
    input.region ?? '-',
    input.countOnly ? 'c' : 'l',
    input.limit,
    input.offset,
  ].join(':')
}

export interface SearchResultItem {
  slug: string
  title: string
  summary: string | null
  amount_text: string | null
  deadline_type: string
  apply_end: string | null
  region_code: string
  segments: string[]
  hasConditions: boolean
  dday: number | null
}

interface Row {
  slug: string
  title: string
  summary: string | null
  amount_text: string | null
  deadline_type: string
  apply_end: string | null
  region_code: string
  segments: string[]
  benefit_conditions: CondLike | CondLike[] | null
}

const SELECT =
  'slug, title, summary, amount_text, deadline_type, apply_end, region_code, segments, benefit_conditions(age_min, age_max, gender, life_stages, household_types, occupations, region_codes)'
const PAGE = 1000 // Supabase 기본 최대 행 수. 넘기려면 .range()로 순회해야 한다.

export async function searchBenefits(
  supabase: SupabaseClient,
  input: SearchInput,
  now = new Date(),
): Promise<{ total: number; items: SearchResultItem[] }> {
  const q: Criteria = { ageRange: ageBandToRange(input.ageBand), situations: input.situations, region: input.region }

  const data: Row[] = []
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from('benefits').select(SELECT).eq('status', 'open').order('slug').range(from, from + PAGE - 1)
    if (q.region) query = query.in('region_code', [q.region, 'ALL'])
    const { data: chunk, error } = await query
    if (error) throw error
    data.push(...((chunk ?? []) as unknown as Row[]))
    if (!chunk || chunk.length < PAGE) break
  }

  const matched = data
    .map((r) => {
      const cond = Array.isArray(r.benefit_conditions) ? (r.benefit_conditions[0] ?? null) : r.benefit_conditions
      return { row: r, cond }
    })
    .filter(({ cond }) => !cond || matchesConditions(cond, q))
    .map(({ row, cond }) => ({
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      amount_text: row.amount_text,
      deadline_type: row.deadline_type,
      apply_end: row.apply_end,
      region_code: row.region_code,
      segments: row.segments,
      hasConditions: !!cond,
      dday: daysUntil(row.apply_end, now),
    }))

  const ranked = rankBenefits(matched, now)
  return { total: ranked.length, items: input.countOnly ? [] : ranked.slice(input.offset, input.offset + input.limit) }
}
