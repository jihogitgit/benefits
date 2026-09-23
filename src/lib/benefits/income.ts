import { MEDIAN_INCOME_2026, MAX_HOUSEHOLD_SIZE } from '../../../data/median-income'

/**
 * 보조금24 소득 조건 코드(JA0201~JA0205)가 나누는 구간. codemap.ts가 코드→값으로
 * 옮겨 놓은 문자열과 같은 값을 쓴다. 계산 결과를 이 구간에 떨어뜨려야 지원금 조건과
 * 맞붙일 수 있다.
 */
export const INCOME_BANDS = ['0-50', '51-75', '76-100', '101-200', '200+'] as const
export type IncomeBand = (typeof INCOME_BANDS)[number]

/** 가구원 수가 표에 있는가. 6인까지만 답한다(근거는 data/median-income.ts 주석). */
export function isSupportedHousehold(size: number): boolean {
  return Number.isInteger(size) && size >= 1 && size <= MAX_HOUSEHOLD_SIZE
}

/** 월 소득이 기준 중위소득의 몇 %인가. 소수 첫째 자리까지. */
export function medianIncomePercent(monthlyIncome: number, householdSize: number): number | null {
  if (!isSupportedHousehold(householdSize)) return null
  if (!Number.isFinite(monthlyIncome) || monthlyIncome < 0) return null
  const base = MEDIAN_INCOME_2026[householdSize]
  return Math.round((monthlyIncome / base) * 1000) / 10
}

/**
 * % 를 조건 코드 구간으로.
 *
 * 경계는 코드가 정한 대로 닫는다: 0-50 은 50까지, 51-75 는 75까지, 76-100 은 100까지,
 * 101-200 은 200까지, 그 위가 200+.
 *
 * 원천 코드가 50과 51 사이를 비워 두어 50.4% 같은 값이 어디에도 안 들어간다. 이런 값은
 * **위 구간으로 올린다**. 구간은 사업이 정한 상한이므로, 50.4%인 사람을 0-50에 넣으면
 * '중위소득 50% 이하' 사업을 받을 수 있다고 말하게 된다 — 실제로는 못 받는다.
 * 받을 수 있는 것을 빠뜨리는 쪽보다 못 받는 것을 보여주는 쪽이 나쁘다. 신청하고 떨어지는
 * 비용이 못 보고 지나치는 비용보다 크고, checklist.ts도 애매하면 충족으로 세지 않는다.
 */
export function bandOf(percent: number): IncomeBand {
  if (percent <= 50) return '0-50'
  if (percent <= 75) return '51-75'
  if (percent <= 100) return '76-100'
  if (percent <= 200) return '101-200'
  return '200+'
}

/**
 * 내 구간에서 자격이 되는 조건 구간 전부.
 *
 * "중위소득 75% 이하" 사업은 50% 이하인 사람도 받는다. 조건에 실린 구간은 상한이므로,
 * 내 구간보다 위쪽 구간이 걸린 사업까지 포함해야 한다. 이걸 빼면 가장 가난한 사람에게
 * 가장 적은 결과를 보여주는 뒤집힌 화면이 된다.
 */
export function eligibleBands(mine: IncomeBand): IncomeBand[] {
  const i = INCOME_BANDS.indexOf(mine)
  return INCOME_BANDS.slice(i)
}

/** 가구원 수의 중위소득 X% 금액(원). 표에 없는 가구원 수면 null. */
export function amountAt(householdSize: number, percent: number): number | null {
  if (!isSupportedHousehold(householdSize)) return null
  return Math.round((MEDIAN_INCOME_2026[householdSize] * percent) / 100)
}
