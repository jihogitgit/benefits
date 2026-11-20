/**
 * 2027년 양육지원급여 개편안 — 아이맞이지원금·아동기본수당 (단위: 만 원).
 *
 * 출처: 보건복지부 보도참고자료 「아이 양육이 어렵지 않도록, 고립은둔 청년에 나아갈 힘이 되도록,
 *   2027년 핵심 청년 예산 발표」(2026-08-28)
 *   https://mohw.go.kr/board.es?act=view&bid=0027&list_no=1491722&mid=a10503010100
 *   본문 표 < 현행 > · < 개편안 >, 붙임1 질의응답 Q1~Q9
 *
 * 값은 기억으로 적지 않았다. 첨부 PDF를 받아 글자로 풀고(pdftotext) 표에서 옮겼다. 붙임1 Q1의
 * 누계 12개(첫째·둘째·셋째 × 수도권/인구감소특별 × 현행/개편)와 Q6의 총 지급액 4개가 아래 값에서
 * 그대로 재현되는지 테스트가 본다(child-welcome.test.ts).
 *
 * **정부안이다.** 국회 예산 심의와 「아동수당법」 개정 전이라 금액·대상·시행일이 바뀔 수 있다.
 * 확정되면 STATUS와 값을 함께 고치고 같은 방식으로 다시 대조한다. 우대지역 목록은 원문이
 * "조정 중"이라 싣지 않는다 — 확인하지 못한 목록으로 지역을 판정하지 않는다.
 */

export const CHILD_WELCOME_SOURCE = {
  label: '보건복지부 보도참고자료 「2027년 핵심 청년 예산 발표」(2026-08-28)',
  url: 'https://mohw.go.kr/board.es?act=view&bid=0027&list_no=1491722&mid=a10503010100',
  /** 원문과 대조한 날 */
  checkedAt: '2026-11-20',
}

/** 개편안이 적용되는 첫 출생일(Q8). */
export const REFORM_FIRST_BIRTH = '2027-07-01'

export type BirthOrder = 1 | 2 | 3 // 3 = 셋째 이상
export type Area = 'basic' | 'priority' // 기본 / 우대지역
export type Care = 'home' | 'daycare' // 가정 보육 / 어린이집 이용

/** 아이맞이지원금 총액. 출생 후 1년 동안 분기별 4회로 나눠 현금 지급. */
export const WELCOME_TOTAL: Record<Area, Record<BirthOrder, number>> = {
  basic: { 1: 1000, 2: 1200, 3: 1500 },
  priority: { 1: 1500, 2: 1700, 3: 2000 },
}

/** 아동기본수당 월액(0~12세). 절반은 현금, 절반은 지역사랑상품권. */
export const BASIC_ALLOWANCE_MONTHLY: Record<Area, number> = { basic: 20, priority: 30 }

/** 가정 보육 가산금 월액. 어린이집을 이용하지 않는 0~1세. */
export const HOME_CARE_BONUS_MONTHLY = 30

/** 현행 제도(2027-06-30 출생아까지). */
export const CURRENT = {
  /** 첫만남이용권(바우처, 1회): 첫째 200, 둘째 이상 300 */
  firstMeeting: { 1: 200, 2: 300, 3: 300 } as Record<BirthOrder, number>,
  /** 부모급여 월액(현금): 0세 100, 1세 50 */
  parentBenefit: { age0: 100, age1: 50 },
  /**
   * 아동수당 월액. 원문 비교표(Q1)가 개편안의 기본↔수도권, 우대지역↔인구감소지역(특별)을 짝지어
   * 그대로 따른다. 비수도권 10.5, 인구감소 우대 11(지역화폐로 받으면 +1)은 비교표에 없어 계산에 쓰지 않는다.
   */
  childAllowance: { basic: 10, priority: 12 } as Record<Area, number>,
}
