import type { SupabaseClient } from '@supabase/supabase-js'
import { SITUATION_TO_CONDITIONS } from '@/lib/conditions/codemap'
import { normalizeQuery, queryTokens } from './query-text'
import { conditionFilters } from './condition-filter'
import { REGIONS } from '../../../data/regions'
import { daysUntil } from './status'

import { AGE_BANDS, YOUNGEST_BAND_FLOOR, type AgeBand } from './age-bands'

export { AGE_BANDS }
export type { AgeBand }
const SITUATIONS = Object.keys(SITUATION_TO_CONDITIONS)
const REGION_SLUGS = new Set(REGIONS.map((r) => r.slug))

export interface SearchInput {
  q: string
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
    q: normalizeQuery(sp.get('q')),
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
 * 이 나이 구간이 '신청자 나이'로 읽힐 수 있는지.
 *
 * 원천(보조금24 supportConditions)은 JA0110/JA0111에 '대상자' 나이를 담는다. 대부분은
 * 대상자가 곧 신청자라 그대로 쓰면 되는데, 영유아 사업은 대상자가 아이다. 아동수당은
 * 0~7세, 부모급여는 0~2세로 들어온다. 진단이 묻는 것은 신청자 나이(10대~50대 이상)이므로
 * 상한이 10 미만인 구간은 어떤 밴드와도 겹치지 않는다 — 거르는 게 아니라 레코드를
 * 통째로 지운다.
 *
 * 실측(2026-09): 이런 행이 진행 중인 것만 198건이고 **전부 parenting 세그먼트**다.
 * 아동수당·가정양육수당·영유아보육료·유아학비(누리과정)·저소득층 기저귀조제분유가 여기
 * 들어 있었다. 나이를 하나라도 고른 사용자에게는 이 198건이 통째로 안 보였다.
 *
 * 원천 값을 고치지 않고 읽는 쪽에서 판단한다. JA0110/JA0111이 담은 아이 나이는 그 자체로
 * 사실이고, 지우면 나중에 생애주기로 옮길 근거까지 사라진다.
 */
function isApplicantAge(c: CondLike): boolean {
  return c.age_max === null || c.age_max >= YOUNGEST_BAND_FLOOR
}

/**
 * 나이 조건이 하나라도 등록돼 있는지. 없으면 '전 연령'이라 거르지도, 가점하지도 않는다.
 * age_min·age_max는 각각 독립적으로 null일 수 있다(실데이터에 한쪽만 있는 행이 존재한다).
 * 신청자 나이로 읽을 수 없는 구간은 조건이 없는 것으로 본다.
 */
function hasAgeCond(c: CondLike): boolean {
  return (c.age_min !== null || c.age_max !== null) && isApplicantAge(c)
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

/**
 * 검색어가 제목에 직접 들어간 항목을 기관명만 걸린 항목보다 앞세운다.
 * '근로장려금'을 찾을 때 같은 기관(국세청)의 다른 지원금이 위로 오는 것을 막는다.
 * 상황 일치(2점)와 같은 무게라 검색어와 조건이 함께 걸린 항목이 가장 위에 온다.
 */
export function titleHitBonus(title: string, tokens: string[]): number {
  if (tokens.length === 0) return 0
  const t = title.toLowerCase()
  return tokens.every((k) => t.includes(k.toLowerCase())) ? 2 : 0
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
    input.q || '-',
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


/**
 * 랭킹에 필요한 최소 컬럼. 제목은 가점 계산에 쓰이므로 포함하고, 요약·금액 등 화면 전용 필드는
 * 페이지가 정해진 뒤에 그 몇 건만 따로 가져온다(요약이 전송량의 대부분이었다).
 * 타입을 string으로 넓힌 이유: supabase-js는 select 문자열을 타입 수준에서 파싱하는데
 * '!inner' 문법에서 인스턴스화가 폭주한다(TS2589). 행 타입은 RankRow/FullRow로 직접 준다.
 */
const SELECT_RANK: string =
  'id, slug, title, deadline_type, apply_end, benefit_conditions!inner(age_min, age_max, life_stages, household_types, occupations, region_codes)'
/** 조건 행이 없는 지원금용. !inner가 이들을 떨구므로 따로 조회해 합친다. */
const SELECT_RANK_ORPHAN: string = 'id, slug, title, deadline_type, apply_end, benefit_conditions(benefit_id)'
/** 실제로 화면에 나가는 페이지 분량에만 쓰는 전체 컬럼. */
const SELECT_FULL: string = 'id, slug, title, summary, amount_text, deadline_type, apply_end, region_code, segments, agency'
const PAGE = 1000 // Supabase 기본 최대 행 수. 넘기려면 .range()로 순회해야 한다.

interface RankRow {
  /**
   * 전체 컬럼을 되받을 때 쓰는 키. slug를 쓰면 안 된다 — slug는 한글을 보존하고(최대 60자)
   * 퍼센트 인코딩에서 한 글자가 9문자가 되어, limit 70 이상에서 in() 쿼리스트링이
   * undici의 헤더 한도를 넘겨 UND_ERR_HEADERS_OVERFLOW로 터졌다(실측). uuid는 36자 ASCII로 고정이다.
   */
  id: string
  slug: string
  /** 점수에 필요하다. 제목 가점을 정렬 뒤에 더하면 순위에 반영되지 않는다. */
  title: string
  deadline_type: string
  apply_end: string | null
  benefit_conditions?: CondLike | CondLike[] | null
}

interface FullRow {
  id: string
  slug: string
  title: string
  summary: string | null
  amount_text: string | null
  deadline_type: string
  apply_end: string | null
  region_code: string
  segments: string[]
  agency: string | null
}

/**
 * 필터를 얹을 수 있는 쿼리 빌더의 최소 형태.
 *
 * supabase-js의 빌더 타입은 select 문자열을 타입 수준에서 파싱해 select마다 다른 타입이 되고,
 * 여기에 제네릭을 얹으면 인스턴스화가 폭주한다(TS2589). 필요한 메서드만 구조적으로 선언하고
 * 경계에서 한 번 캐스팅한다 — 행 타입은 RankRow/FullRow로 직접 주므로 잃는 검사가 없다.
 * count는 head:true 조회에서만 채워진다.
 */
interface QueryBuilder extends PromiseLike<{ data: unknown[] | null; count?: number | null; error: unknown }> {
  eq(column: string, value: unknown): QueryBuilder
  in(column: string, values: readonly unknown[]): QueryBuilder
  or(filters: string, options?: { referencedTable?: string }): QueryBuilder
  is(column: string, value: null): QueryBuilder
  order(column: string): QueryBuilder
  range(from: number, to: number): QueryBuilder
}

/** supabase-js 빌더를 위 최소 형태로. 캐스팅을 이 함수 하나에 모아 둔다. */
function q0(builder: unknown): QueryBuilder {
  return builder as QueryBuilder
}

/**
 * benefits 본표에 걸리는 조건: 공개 상태, 지역, 검색어.
 * 조건표(benefit_conditions)에 걸리는 필터는 호출자가 conditionFilters로 따로 얹는다.
 */
function applyBaseFilters(query: QueryBuilder, q: Criteria, tokens: string[]): QueryBuilder {
  let out = query.eq('status', 'open')
  if (q.region) out = out.in('region_code', [q.region, 'ALL'])
  // 토큰마다 or()를 한 번씩 걸면 PostgREST가 서로 AND로 묶어 '청년 월세'가 두 단어를 모두
  // 가진 항목만 남긴다(or= 파라미터 반복이 AND라는 건 실측으로 확인했다).
  //
  // 요약까지 뒤지는 이유: 공식 명칭과 통용 명칭이 다른 경우가 많다. '근로장려금'은 실제 제목이
  // '근로·자녀장려금'이라 제목·기관만 보면 0건이지만 요약에는 그대로 적혀 있다. 잡음은
  // 실측으로 '청년' 349→392건 수준이고, 제목에 걸린 항목은 titleHitBonus가 위로 올린다.
  for (const t of tokens) out = out.or(`title.ilike.%${t}%,agency.ilike.%${t}%,summary.ilike.%${t}%`)
  return out
}

/** 조건표 필터를 얹는다. supabase-js는 .or() 호출을 서로 AND로 누적한다. */
function applyConditionFilters(query: QueryBuilder, filters: string[]): QueryBuilder {
  let out = query
  for (const f of filters) out = out.or(f, { referencedTable: 'benefit_conditions' })
  return out
}

/** PostgrestError는 Error 인스턴스가 아니라 스택이 없다. 감싸야 로그에서 어디서 났는지 보인다. */
function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(`PostgREST: ${JSON.stringify(error)}`)
}

async function runCount(query: QueryBuilder): Promise<number> {
  const { count, error } = await query
  if (error) throw toError(error)
  return count ?? 0
}

async function runRows<T>(query: QueryBuilder): Promise<T[]> {
  const { data, error } = await query
  if (error) throw toError(error)
  return (data ?? []) as unknown as T[]
}

/** 조건 행이 있는 대상 수. 행은 한 건도 가져오지 않는다. */
function countWithConditions(supabase: SupabaseClient, q: Criteria, tokens: string[], filters: string[]): Promise<number> {
  const base = q0(supabase.from('benefits').select('slug, benefit_conditions!inner(benefit_id)', { count: 'exact', head: true }))
  return runCount(applyConditionFilters(applyBaseFilters(base, q, tokens), filters))
}

/**
 * 조건 행이 아예 없는 대상 수.
 * 동기화가 supportConditions 응답이 없는 서비스는 조건 행을 쓰지 않으므로(gov24-sync의
 * `if (!id || !c) continue`) 이런 행이 생길 수 있다. 조건이 없으면 무엇으로도 거를 수 없어
 * 전부 통과시키는 것이 기존 판정이고, !inner는 이들을 떨구므로 따로 세서 합친다.
 */
function countOrphans(supabase: SupabaseClient, q: Criteria, tokens: string[]): Promise<number> {
  const base = q0(supabase.from('benefits').select(SELECT_RANK_ORPHAN, { count: 'exact', head: true }))
  return runCount(applyBaseFilters(base, q, tokens).is('benefit_conditions', null))
}

/**
 * 한 번에 띄울 수 있는 페이지 조회 수. 상한이 없으면 데이터가 늘수록 동시 요청도 같이 늘어
 * 요청 하나가 PostgREST 커넥션 풀을 통째로 물 수 있다. 6이면 11페이지가 두 라운드라
 * 순차 대비 이득은 거의 그대로 남는다.
 */
const MAX_CONCURRENT_PAGES = 6

/** 총건수를 먼저 안 뒤 페이지를 나눠 동시에 받는다. 순차 순회는 왕복 횟수만큼 지연이 쌓인다. */
async function fetchAllPages<T>(makeQuery: (from: number, to: number) => QueryBuilder, total: number): Promise<T[]> {
  if (total === 0) return []
  const pages = Math.ceil(total / PAGE)
  const out: T[] = []
  for (let i = 0; i < pages; i += MAX_CONCURRENT_PAGES) {
    const batch = Array.from({ length: Math.min(MAX_CONCURRENT_PAGES, pages - i) }, (_, k) => {
      const from = (i + k) * PAGE
      return runRows<T>(makeQuery(from, from + PAGE - 1))
    })
    for (const chunk of await Promise.all(batch)) out.push(...chunk)
  }
  // total은 카운트 조회 시점 값이라, 그 사이 동기화가 행을 넣으면 마지막 페이지가 잘린다.
  // 예전 순차 순회의 '짧은 페이지가 나오면 종료' 불변식을 꼬리로 되살린다. 보통 한 번도 안 돈다.
  for (let i = pages; out.length >= i * PAGE; i++) {
    const extra = await runRows<T>(makeQuery(i * PAGE, i * PAGE + PAGE - 1))
    if (extra.length === 0) break
    out.push(...extra)
  }
  return out
}

export async function searchBenefits(
  supabase: SupabaseClient,
  input: SearchInput,
  now = new Date(),
): Promise<{ total: number; items: SearchResultItem[] }> {
  const q: Criteria = { ageRange: ageBandToRange(input.ageBand), situations: input.situations, region: input.region }
  const tokens = queryTokens(input.q)
  const filters = conditionFilters(q)

  const [nWith, nOrphan] = await Promise.all([
    countWithConditions(supabase, q, tokens, filters),
    countOrphans(supabase, q, tokens),
  ])
  const total = nWith + nOrphan

  // 개수만 필요한 요청(홈의 CTA)은 여기서 끝난다. 예전에는 이 한 번에 전체 테이블을 끌어와
  // 프로덕션에서 12~14초가 걸렸다.
  if (input.countOnly) return { total, items: [] }

  // 범위를 벗어난 offset으로 전체 랭킹 조회를 수행하고 빈 슬라이스를 내놓는 헛수고를 막는다.
  // offset은 상한이 없고 캐시 키에도 들어가서, 바꿔가며 부르면 캐시를 매번 빗나간다.
  if (input.offset >= total) return { total, items: [] }

  const [withCond, orphans] = await Promise.all([
    fetchAllPages<RankRow>(
      (from, to) =>
        applyConditionFilters(
          applyBaseFilters(q0(supabase.from('benefits').select(SELECT_RANK)), q, tokens),
          filters,
        ).order('slug').range(from, to),
      nWith,
    ),
    fetchAllPages<RankRow>(
      (from, to) =>
        applyBaseFilters(q0(supabase.from('benefits').select(SELECT_RANK_ORPHAN)), q, tokens)
          .is('benefit_conditions', null)
          .order('slug')
          .range(from, to),
      nOrphan,
    ),
  ])

  const ranked = rankBenefits(
    [...withCond, ...orphans].map((r) => {
      const cond = Array.isArray(r.benefit_conditions) ? (r.benefit_conditions[0] ?? null) : (r.benefit_conditions ?? null)
      // 조건 행이 있는 쪽은 DB가 이미 걸렀으므로 여기서 다시 판정하지 않는다. 점수만 매긴다.
      return {
        id: r.id,
        slug: r.slug,
        deadline_type: r.deadline_type,
        apply_end: r.apply_end,
        hasConditions: cond !== null,
        // 가점을 여기서 함께 매긴다. 정렬이 이 점수로 이뤄지므로 나중에 더하면 순위가 바뀌지 않는다.
        score: matchScore(cond, q) + titleHitBonus(r.title, tokens),
      }
    }),
    now,
  )

  // 여기서부터 total은 카운트 쿼리 값이 아니라 실제로 순위를 매긴 건수를 쓴다. 두 값이 다른
  // 쿼리에서 오면 'N건'이라 써놓고 목록은 비어 있는, 예전 코드에는 없던 상태가 만들어진다.
  const rankedTotal = ranked.length
  const page = ranked.slice(input.offset, input.offset + input.limit)
  if (page.length === 0) return { total: rankedTotal, items: [] }

  // 화면에 나갈 몇 건만 전체 컬럼으로 가져온다. 순위를 매기려고 1만 건의 제목·요약까지
  // 끌어오던 것이 전송량의 대부분이었다.
  const full = await runRows<FullRow>(
    q0(supabase.from('benefits').select(SELECT_FULL))
      // 랭킹 조회와 이 조회 사이에 동기화가 status를 바꾼 행은 내보내지 않는다.
      .eq('status', 'open')
      .in(
        'id',
        page.map((r) => r.id),
      ),
  )
  const byId = new Map(full.map((r) => [r.id, r]))

  const items: SearchResultItem[] = []
  for (const r of page) {
    const f = byId.get(r.id)
    if (!f) continue // 조회와 상세 사이에 사라진 행. 빠뜨릴지언정 빈 카드를 그리지는 않는다.
    items.push({
      slug: f.slug,
      title: f.title,
      summary: f.summary,
      amount_text: f.amount_text,
      deadline_type: f.deadline_type,
      apply_end: f.apply_end,
      region_code: f.region_code,
      segments: f.segments,
      agency: f.agency,
      hasConditions: r.hasConditions,
      dday: daysUntil(f.apply_end, now),
      score: r.score,
    })
  }
  return { total: rankedTotal, items }
}
