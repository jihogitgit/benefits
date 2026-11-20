import {
  BASIC_ALLOWANCE_MONTHLY, CURRENT, HOME_CARE_BONUS_MONTHLY, REFORM_FIRST_BIRTH, WELCOME_TOTAL,
  type Area, type BirthOrder, type Care,
} from '../../../data/child-welcome'

export interface ChildInput {
  order: BirthOrder
  area: Area
  care: Care
}

/** 연령 구간별 금액(만 원). year0 = 0세 한 해, year1 = 1세 한 해, later = 2~12세 11년. */
export interface Breakdown {
  year0: number
  year1: number
  later: number
  total: number
}

const LATER_YEARS = 11 // 2~12세

/** 개편안(2027-07-01 이후 출생). 0~12세 내내 같은 지역·같은 보육 방식이라고 가정한 합계다. */
export function reformPlan(i: ChildInput): Breakdown & { welcome: number; quarterly: number; monthly0to1: number; monthlyLater: number; voucherTotal: number } {
  const base = BASIC_ALLOWANCE_MONTHLY[i.area]
  const monthly0to1 = base + (i.care === 'home' ? HOME_CARE_BONUS_MONTHLY : 0)
  const welcome = WELCOME_TOTAL[i.area][i.order]
  const year0 = welcome + monthly0to1 * 12
  const year1 = monthly0to1 * 12
  const later = base * 12 * LATER_YEARS
  return {
    welcome, quarterly: welcome / 4, monthly0to1, monthlyLater: base,
    year0, year1, later, total: year0 + year1 + later,
    // 아동기본수당의 절반이 지역사랑상품권이다(13년치). 가산금·아이맞이지원금은 넣지 않는다.
    voucherTotal: (base / 2) * 12 * (LATER_YEARS + 2),
  }
}

/**
 * 현행 제도(2027-06-30 출생아까지), 가정 보육 기준. 어린이집을 이용하면 부모급여가 보육료 이용권으로
 * 바뀌어 현금 수령액이 달라지는데 원문 비교표가 그 경우를 싣지 않아 null을 낸다(만들어 내지 않는다).
 */
export function currentPlan(i: ChildInput): Breakdown | null {
  if (i.care !== 'home') return null
  const a = CURRENT.childAllowance[i.area]
  const year0 = CURRENT.firstMeeting[i.order] + (CURRENT.parentBenefit.age0 + a) * 12
  const year1 = (CURRENT.parentBenefit.age1 + a) * 12
  const later = a * 12 * LATER_YEARS
  return { year0, year1, later, total: year0 + year1 + later }
}

/** 'YYYY-MM' 출생월이 개편안 대상인가. 7월 1일 이후 출생이므로 2027-07부터. */
export function isReformBirthMonth(ym: string): boolean {
  return ym >= REFORM_FIRST_BIRTH.slice(0, 7)
}

/**
 * 아이맞이지원금 지급월 4개('YYYY-MM'). 출생월부터 3개월 간격. 원문 Q2는 7월생(7·10·1·4월)과 8월생(8·11·2·5월)
 * 두 예만 든다 — 다른 달은 같은 규칙을 넓힌 것이다.
 */
export function welcomePayMonths(ym: string): string[] {
  const [y, m] = ym.split('-').map(Number)
  return [0, 3, 6, 9].map((k) => {
    const t = (m - 1) + k
    return `${y + Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
  })
}
