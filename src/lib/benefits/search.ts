import type { SupabaseClient } from '@supabase/supabase-js'
import { SITUATION_TO_CONDITIONS } from '@/lib/conditions/codemap'
import { REGIONS } from '../../../data/regions'
import { daysUntil } from './status'

import { AGE_BANDS, type AgeBand } from './age-bands'

export { AGE_BANDS }
export type { AgeBand }
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
    // 중복 제거: 같은 결과에 서로 다른 캐시 키가 생기는 것을 막는다
    situations: [
      ...new Set(
        (sp.get('situations') ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter((s) => SITUATIONS.includes(s)),
      ),
    ],
    region: region && REGION_SLUGS.has(region) ? region : null,
    countOnly: sp.get('count') === '1',
    limit: Math.min(100, Math.max(1, Number(sp.get('limit') ?? 50) || 50)),
    offset: Math.max(0, Number(sp.get('offset') ?? 0) || 0),
  }
}

/** 나이 상한 없음을 나타내는 경계값. ageBandToRange·조건 비교가 같은 값을 써야 한다. */
export const AGE_MAX = 120

export function ageBandToRange(band: AgeBand | null): [number, number] | null {
  if (!band) return null
  if (band === '50s+') return [50, AGE_MAX]
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
 * 나이 조건이 하나라도 등록돼 있는지. 없으면 '전 연령'이라 거르지도, 가점하지도 않는다.
 * age_min·age_max는 각각 독립적으로 null일 수 있다(실데이터에 한쪽만 있는 행이 존재한다).
 */
function hasAgeCond(c: CondLike): boolean {
  return c.age_min !== null || c.age_max !== null
}

/** 조건의 나이 구간이 사용자 나이대와 겹치는지. 열린 쪽은 경계 없음으로 본다. 겹침만 판단하며 조건 유무는 보지 않는다. */
function ageOverlaps(c: CondLike, range: [number, number]): boolean {
  return (c.age_max ?? AGE_MAX) >= range[0] && (c.age_min ?? 0) <= range[1]
}

/** 상황 조건(생애주기·가구·직업)이 하나라도 등록돼 있는지. 없으면 '전 국민 대상'이라 상황으로 판정할 수 없다. */
function hasSituationCond(c: CondLike): boolean {
  return c.life_stages.length + c.household_types.length + c.occupations.length > 0
}

/** 사용자가 고른 상황 중 하나라도 조건 행이 실제로 만족하는지. 통과 판정과 점수가 같은 기준을 쓰도록 공유한다. */
function situationHit(c: CondLike, situations: string[]): boolean {
  return situations
    .map((s) => SITUATION_TO_CONDITIONS[s])
    .filter(Boolean)
    .some(
      (w) =>
        (w.life ?? []).some((v) => c.life_stages.includes(v)) ||
        (w.household ?? []).some((v) => c.household_types.includes(v)) ||
        (w.occupation ?? []).some((v) => c.occupations.includes(v)),
    )
}

/**
 * 조건 행이 입력 조건에 맞는지. 조건이 비어 있는 축은 거르지 않는다(전국·전연령·상황무관).
 * 상황은 하나라도 일치하면 통과.
 */
export function matchesConditions(c: CondLike, q: Criteria): boolean {
  if (q.ageRange && hasAgeCond(c) && !ageOverlaps(c, q.ageRange)) return false
  if (q.region && c.region_codes.length > 0 && !c.region_codes.includes(q.region)) return false
  if (q.situations.length > 0 && hasSituationCond(c) && !situationHit(c, q.situations)) return false
  return true
}

/**
 * 사용자 입력과 실제로 맞물린 정도. 상황 일치 2, 지역 일치 1, 나이 구간 겹침 1. 조건 없음은 0.
 * export된 함수이므로 사전 필터(matchesConditions) 통과를 전제하지 않고 스스로 일치를 확인한다.
 * matchesConditions는 '거르지 않는다'가 기본이라 조건이 아예 없는 전 국민 대상 항목도 통과한다.
 * 그 결과 20대·구직 검색에 인플루엔자 예방접종이 상단에 오던 문제(Plan 1)를 이 점수로 뒤로 민다.
 */
export function matchScore(c: CondLike | null, q: Criteria): number {
  if (!c) return 0
  let s = 0
  if (q.situations.length && hasSituationCond(c) && situationHit(c, q.situations)) s += 2
  if (q.region && c.region_codes.includes(q.region)) s += 1
  if (q.ageRange && hasAgeCond(c) && ageOverlaps(c, q.ageRange)) s += 1
  return s
}

export interface Rankable {
  slug: string
  deadline_type: string
  apply_end: string | null
  hasConditions: boolean
  score: number
}

/** 조건 일치 점수 내림차순 → 마감 임박(기간) → 상시/미확정 → 조건 확인 필요. 같은 그룹 안은 D-day 오름차순, 그 외 slug 순. */
export function rankBenefits<T extends Rankable>(rows: T[], now: Date): T[] {
  const group = (r: Rankable) => (!r.hasConditions ? 2 : r.deadline_type === 'period' && r.apply_end ? 0 : 1)
  return [...rows].sort((a, b) => {
    const s = b.score - a.score
    if (s !== 0) return s
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
  agency: string | null
  hasConditions: boolean
  dday: number | null
  score: number
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
  agency: string | null
  benefit_conditions: CondLike | CondLike[] | null
}

const SELECT =
  'slug, title, summary, amount_text, deadline_type, apply_end, region_code, segments, agency, benefit_conditions(age_min, age_max, gender, life_stages, household_types, occupations, region_codes)'
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
      agency: row.agency,
      hasConditions: !!cond,
      dday: daysUntil(row.apply_end, now),
      score: matchScore(cond, q),
    }))

  const ranked = rankBenefits(matched, now)
  return { total: ranked.length, items: input.countOnly ? [] : ranked.slice(input.offset, input.offset + input.limit) }
}
