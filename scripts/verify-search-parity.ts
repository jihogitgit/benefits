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
import { searchBenefits, matchesConditions, ageBandToRange, type Criteria, type CondLike, type SearchInput } from '../src/lib/benefits/search'
import { queryTokens } from '../src/lib/benefits/query-text'
import { AGE_BANDS } from '../src/lib/benefits/age-bands'

const PAGE = 1000
const SELECT =
  'slug, title, summary, agency, benefit_conditions(age_min, age_max, gender, life_stages, household_types, occupations, region_codes)'

interface LegacyRow {
  slug: string
  title: string
  summary: string | null
  agency: string | null
  benefit_conditions: CondLike | CondLike[] | null
}

/** 예전 구현 그대로: 전건을 끌어와 JS로 거른다. 비교 기준이므로 일부러 최적화하지 않는다. */
async function legacyCount(supabase: ReturnType<typeof createAdminClient>, input: SearchInput): Promise<number> {
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
  return rows.filter((r) => {
    const c = Array.isArray(r.benefit_conditions) ? (r.benefit_conditions[0] ?? null) : r.benefit_conditions
    return !c || matchesConditions(c, q)
  }).length
}

const SITUATIONS = ['job_seeker', 'pregnancy', 'has_child', 'single', 'no_house', 'student', 'business']
const REGIONS = ['seoul', 'busan', 'jeonnam-gwangju']
const QUERIES = ['', '국민연금', '청년 월세', '창업지원']

function cases(): SearchInput[] {
  const base = { countOnly: true, limit: 50, offset: 0 } as const
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
  let mismatches = 0
  for (const input of cases()) {
    const [now, before] = await Promise.all([searchBenefits(supabase, input), legacyCount(supabase, input)])
    const ok = now.total === before
    if (!ok) mismatches += 1
    console.log(`${ok ? '  OK ' : 'DIFF '} ${label(input).padEnd(52)} new=${now.total} old=${before}`)
  }
  console.log(mismatches === 0 ? `\n전 ${cases().length}건 일치` : `\n불일치 ${mismatches}건`)
  process.exit(mismatches === 0 ? 0 : 1)
}

void main()
