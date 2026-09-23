import { SITUATION_TO_CONDITIONS } from '@/lib/conditions/codemap'
import type { Criteria } from './search'
import { YOUNGEST_BAND_FLOOR } from './age-bands'
import { INCOME_BANDS } from './income'

/**
 * 조건 판정을 DB로 내린다.
 *
 * 원래는 open 상태 1만여 건을 1000건씩 11번 왕복해 전부 끌어온 뒤 matchesConditions로 걸렀다.
 * 프로덕션 실측으로 캐시에 없는 조합 하나가 12~14초였다(홈에서 칩을 누를 때마다 나가는 요청이다).
 * 여기서 만드는 필터는 matchesConditions와 같은 판정을 PostgREST 표현으로 옮긴 것이며,
 * 같은 결과를 내는지는 __tests__/condition-filter.test.ts와 scripts/verify-search-parity.ts가 지킨다.
 *
 * 값은 전부 내부 허용목록에서 온다(나이는 ageBandToRange가 만든 정수, 지역은 REGION_SLUGS,
 * 상황은 SITUATION_TO_CONDITIONS의 키). 사용자 입력이 그대로 들어오는 자리가 없어 이스케이프가
 * 필요 없고, 혹시 모를 회귀를 막으려고 assertSafe로 한 번 더 확인한다.
 */

/** PostgREST 필터 문법을 깨뜨릴 수 있는 문자가 값에 섞이지 않았는지. 들어오면 버그다. */
function assertSafe(value: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error(`조건 필터에 쓸 수 없는 값: ${value}`)
  return value
}

/**
 * 소득 구간 값은 '0-50', '200+' 처럼 assertSafe가 막는 문자를 쓴다. 값은 내부 상수
 * INCOME_BANDS에서만 오므로 그 목록에 있는지로 확인한다.
 */
function assertSafeBand(value: string): string {
  if (!(INCOME_BANDS as readonly string[]).includes(value)) throw new Error(`조건 필터에 쓸 수 없는 소득 구간: ${value}`)
  return value
}

/** 나이 경계도 같은 원칙으로 확인한다. NaN이 그대로 보간되면 PostgREST가 400을 내고 500으로 둔갑한다. */
function assertInt(value: number): number {
  if (!Number.isInteger(value)) throw new Error(`조건 필터에 쓸 수 없는 값: ${value}`)
  return value
}

/**
 * 상황 조건이 하나도 없는 행. matchesConditions의 hasSituationCond === false 와 같다.
 *
 * 세 축이 다 비어도 대상 나이가 아이면 상황이 있는 것으로 본다(search.ts의 isChildTarget).
 * 그래서 나이 상한 조건이 함께 붙는다 — 빠지면 영유아 사업이 아무 상황에나 통과해
 * SQL 총건수와 JS 목록이 갈라진다.
 */
const NO_SITUATION_COND =
  'and(life_stages.eq.{},household_types.eq.{},occupations.eq.{},' +
  `or(age_max.is.null,age_max.gte.${assertInt(YOUNGEST_BAND_FLOOR)}))`

/**
 * Criteria를 benefit_conditions에 적용할 or() 필터 목록으로.
 * 반환된 각 문자열은 서로 AND로 묶여야 한다(supabase-js는 .or() 호출을 AND로 누적한다).
 * 검색어가 없고 조건도 없으면 빈 배열 — 그때는 필터 없이 전체가 대상이다.
 */
export function conditionFilters(q: Criteria): string[] {
  const out: string[] = []

  if (q.ageRange) {
    const [lo, hi] = q.ageRange
    // 나이 조건이 아예 없는 행은 거르지 않는다(전 연령). 한쪽만 있는 행은 열린 쪽을
    // 경계 없음으로 본다 — matchesConditions의 (age_max ?? 120) / (age_min ?? 0)과 같다.
    // 상한이 가장 어린 밴드 밑인 행은 신청자 나이로 읽을 수 없어 조건이 없는 것으로 본다.
    // matchesConditions의 isApplicantAge와 같은 판정이다 — 갈라지면 총건수와 목록이 어긋난다.
    out.push(
      `and(age_min.is.null,age_max.is.null),` +
        `age_max.lt.${assertInt(YOUNGEST_BAND_FLOOR)},` +
        `and(or(age_max.is.null,age_max.gte.${assertInt(lo)}),or(age_min.is.null,age_min.lte.${assertInt(hi)}))`,
    )
  }

  if (q.region) {
    // region_codes가 비어 있으면 전국 대상이라 거르지 않는다.
    out.push(`region_codes.eq.{},region_codes.cs.{${assertSafe(q.region)}}`)
  }

  if (q.incomeBands) {
    // 소득 구간이 비어 있는 행은 소득을 안 보는 사업이라 통과시킨다. matchesConditions의
    // `c.income_bands.length > 0` 과 같은 판정이다 — 갈라지면 총건수와 목록이 어긋난다.
    const bands = q.incomeBands.map(assertSafeBand)
    out.push(`income_bands.eq.{},income_bands.ov.{${bands.join(',')}}`)
  }

  if (q.situations.length > 0) {
    const life = new Set<string>()
    const household = new Set<string>()
    const occupation = new Set<string>()
    for (const s of q.situations) {
      const w = SITUATION_TO_CONDITIONS[s]
      if (!w) continue
      for (const v of w.life ?? []) life.add(assertSafe(v))
      for (const v of w.household ?? []) household.add(assertSafe(v))
      for (const v of w.occupation ?? []) occupation.add(assertSafe(v))
    }
    // 상황 조건이 없는 행은 통과시키고, 있는 행은 고른 상황 중 하나라도 맞아야 한다.
    // 매핑이 하나도 없으면 후자가 성립할 수 없으므로 앞 조건만 남는다 —
    // matchesConditions가 그 경우 상황 조건이 있는 행을 전부 거르는 것과 같다.
    const parts = [NO_SITUATION_COND]
    // 대상이 아이인 행은 '아이를 키우고 있다'에 걸린다. situationHit의 첫 줄과 같은 판정이다.
    if (q.situations.includes('has_child')) parts.push(`age_max.lt.${assertInt(YOUNGEST_BAND_FLOOR)}`)
    if (life.size) parts.push(`life_stages.ov.{${[...life].join(',')}}`)
    if (household.size) parts.push(`household_types.ov.{${[...household].join(',')}}`)
    if (occupation.size) parts.push(`occupations.ov.{${[...occupation].join(',')}}`)
    out.push(parts.join(','))
  }

  return out
}
