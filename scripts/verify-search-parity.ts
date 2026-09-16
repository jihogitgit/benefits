/**
 * 조건 판정을 DB로 내린 뒤에도 예전 방식(전건을 끌어와 matchesConditions로 거르기)과
 * 같은 결과를 내는지 운영 DB로 확인한다.
 *
 * 단위 테스트는 필터 '문자열'만 고정할 수 있고, 그 문자열이 Postgres에서 실제로 같은 행을
 * 고르는지는 DB에 물어봐야만 안다. 조건 필터를 손볼 때마다 이 스크립트를 돌린다.
 *
 *   npm run verify:search
 */
import { createAdminClient } from '../src/lib/supabase/admin'
import {
  searchBenefits,
  matchesConditions,
  matchScore,
  rankBenefits,
  titleHitBonus,
  ageBandToRange,
  type Criteria,
  type CondLike,
  type SearchInput,
} from '../src/lib/benefits/search'
import { queryTokens } from '../src/lib/benefits/query-text'
import { AGE_BANDS } from '../src/lib/benefits/age-bands'

const PAGE = 1000
const SELECT =
  'slug, title, summary, agency, deadline_type, apply_end, benefit_conditions(age_min, age_max, gender, life_stages, household_types, occupations, region_codes)'
/** 목록 비교에서 맞춰볼 상위 건수. 전량을 비교할 필요는 없고 앞쪽이 어긋나면 충분히 드러난다. */
const TOP_N = 8

interface LegacyRow {
  slug: string
  title: string
  summary: string | null
  agency: string | null
  deadline_type: string
  apply_end: string | null
  benefit_conditions: CondLike | CondLike[] | null
}

/** 총건수만이 아니라 상위 목록까지 비교한다. 총건수는 맞고 순서만 틀린 회귀를 실제로 겪었다. */
interface Expected {
  total: number
  top: [string, number][]
}

/** 예전 구현 그대로: 전건을 끌어와 JS로 거른다. 비교 기준이므로 일부러 최적화하지 않는다. */
async function legacy(supabase: ReturnType<typeof createAdminClient>, input: SearchInput, now: Date): Promise<Expected> {
  const q: Criteria = { ageRange: ageBandToRange(input.ageBand), situations: input.situations, region: input.region }
  const tokens = queryTokens(input.q)
  const rows: LegacyRow[] = []
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from('benefits').select(SELECT).eq('status', 'open').order('slug').range(from, from + PAGE - 1)
    if (q.region) query = query.in('region_code', [q.region, 'ALL'])
    for (const t of tokens) query = query.or(`title.ilike.%${t}%,agency.ilike.%${t}%,summary.ilike.%${t}%`)
    const { data, error } = await query
    if (error) throw error
    rows.push(...((data ?? []) as unknown as LegacyRow[]))
    if (!data || data.length < PAGE) break
  }
  const matched = rows
    .map((r) => ({ r, c: Array.isArray(r.benefit_conditions) ? (r.benefit_conditions[0] ?? null) : r.benefit_conditions }))
    .filter(({ c }) => !c || matchesConditions(c, q))
    .map(({ r, c }) => ({
      slug: r.slug,
      deadline_type: r.deadline_type,
      apply_end: r.apply_end,
      hasConditions: !!c,
      score: matchScore(c, q) + titleHitBonus(r.title, tokens),
    }))
  const ranked = rankBenefits(matched, now)
  return {
    total: ranked.length,
    top: ranked.slice(input.offset, input.offset + input.limit).slice(0, TOP_N).map((r) => [r.slug, r.score]),
  }
}

const SITUATIONS = ['job_seeker', 'pregnancy', 'has_child', 'single', 'no_house', 'student', 'business']
const REGIONS = ['seoul', 'busan', 'jeonnam-gwangju']
const QUERIES = ['', '국민연금', '청년 월세', '창업지원']

function cases(): SearchInput[] {
  const base = { countOnly: false, limit: 50, offset: 0 } as const
  const out: SearchInput[] = []
  for (const ageBand of [null, ...AGE_BANDS]) out.push({ ...base, q: '', ageBand, situations: [], region: null })
  for (const s of SITUATIONS) out.push({ ...base, q: '', ageBand: null, situations: [s], region: null })
  for (const region of REGIONS) out.push({ ...base, q: '', ageBand: null, situations: [], region })
  for (const q of QUERIES) out.push({ ...base, q, ageBand: null, situations: [], region: null })
  out.push(
    { ...base, q: '', ageBand: '20s', situations: ['job_seeker'], region: 'seoul' },
    { ...base, q: '', ageBand: '30s', situations: ['has_child', 'no_house'], region: 'busan' },
    { ...base, q: '청년', ageBand: '20s', situations: ['student'], region: 'seoul' },
    { ...base, q: '국민연금', ageBand: '50s+', situations: [], region: null },
    { ...base, q: '', ageBand: '50s+', situations: ['single', 'business'], region: 'jeonnam-gwangju' },
  )
  return out
}

function label(i: SearchInput): string {
  return [i.ageBand ?? '-', i.situations.join('+') || '-', i.region ?? '-', i.q || '-'].join(' | ')
}

async function main() {
  const supabase = createAdminClient()
  const all = cases()
  // 같은 시각을 넘겨야 D-day 정렬이 두 경로에서 갈라지지 않는다.
  const now = new Date()
  let mismatches = 0
  for (const input of all) {
    const [got, want] = await Promise.all([searchBenefits(supabase, input, now), legacy(supabase, input, now)])
    const top = got.items.slice(0, TOP_N).map((i) => [i.slug, i.score] as [string, number])
    const totalOk = got.total === want.total
    const topOk = JSON.stringify(top) === JSON.stringify(want.top)
    if (!totalOk || !topOk) mismatches += 1
    const mark = totalOk && topOk ? '  OK ' : 'DIFF '
    console.log(`${mark} ${label(input).padEnd(52)} total ${got.total}/${want.total} · 상위${TOP_N} ${topOk ? '일치' : '불일치'}`)
    if (!topOk) {
      console.log(`        new: ${JSON.stringify(top.slice(0, 3))}`)
      console.log(`        old: ${JSON.stringify(want.top.slice(0, 3))}`)
    }
  }
  console.log(mismatches === 0 ? `\n전 ${all.length}건 일치` : `\n불일치 ${mismatches}건`)
  // process.exit은 stdout이 파이프일 때 마지막 줄을 잘라먹는다. 종료 코드만 남긴다.
  process.exitCode = mismatches === 0 ? 0 : 1
}

void main()
