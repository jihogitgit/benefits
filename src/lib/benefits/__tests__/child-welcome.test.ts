import { describe, expect, it } from 'vitest'
import { currentPlan, isReformBirthMonth, reformPlan, welcomePayMonths } from '../child-welcome'

// 기대값은 보건복지부 보도참고자료(2026-08-28) 붙임1의 표에서 옮겼다. 계산식이 아니라 원문 숫자와 맞는지 본다.
describe('원문 Q1 비교표(가정 보육) 재현', () => {
  it.each([
    // 순위, 지역, 현행[0세,1세,2~12세(연),누계], 개편[0세,1세,2~12세(연),누계]
    [1, 'basic', [1520, 720, 120, 3560], [1600, 600, 240, 4840]],
    [1, 'priority', [1544, 744, 144, 3872], [2220, 720, 360, 6900]],
    [2, 'basic', [1620, 720, 120, 3660], [1800, 600, 240, 5040]],
    [2, 'priority', [1644, 744, 144, 3972], [2420, 720, 360, 7100]],
    [3, 'basic', [1620, 720, 120, 3660], [2100, 600, 240, 5340]],
    [3, 'priority', [1644, 744, 144, 3972], [2720, 720, 360, 7400]],
  ] as const)('%s째 · %s', (order, area, cur, ref) => {
    const c = currentPlan({ order, area, care: 'home' })!
    expect([c.year0, c.year1, c.later / 11, c.total]).toEqual(cur)
    const r = reformPlan({ order, area, care: 'home' })
    expect([r.year0, r.year1, r.later / 11, r.total]).toEqual(ref)
  })

  it('본문이 밝힌 차액: 수도권 첫째 1,280만 원, 우대지역 첫째 3,028만 원', () => {
    const diff = (area: 'basic' | 'priority') => reformPlan({ order: 1, area, care: 'home' }).total - currentPlan({ order: 1, area, care: 'home' })!.total
    expect(diff('basic')).toBe(1280)
    expect(diff('priority')).toBe(3028)
  })
})

describe('원문 Q2·Q6 표 재현', () => {
  it('분기별 지급액', () => {
    const q = (area: 'basic' | 'priority') => ([1, 2, 3] as const).map((order) => reformPlan({ order, area, care: 'home' }).quarterly)
    expect(q('basic')).toEqual([250, 300, 375])
    expect(q('priority')).toEqual([375, 425, 500])
  })
  it('아동기본수당 총 지급액(아이맞이지원금 제외): 미이용 3,840/5,400, 이용 3,120/4,680', () => {
    const allowance = (area: 'basic' | 'priority', care: 'home' | 'daycare') => {
      const r = reformPlan({ order: 1, area, care })
      return r.total - r.welcome
    }
    expect(allowance('basic', 'home')).toBe(3840)
    expect(allowance('priority', 'home')).toBe(5400)
    expect(allowance('basic', 'daycare')).toBe(3120)
    expect(allowance('priority', 'daycare')).toBe(4680)
  })
  it('지급월 예시: 7월생 → 7·10·1·4월, 8월생 → 8·11·2·5월', () => {
    expect(welcomePayMonths('2027-07')).toEqual(['2027-07', '2027-10', '2028-01', '2028-04'])
    expect(welcomePayMonths('2027-08')).toEqual(['2027-08', '2027-11', '2028-02', '2028-05'])
    expect(welcomePayMonths('2027-12')).toEqual(['2027-12', '2028-03', '2028-06', '2028-09'])
  })
})

describe('경계', () => {
  it('2027년 7월 출생부터 개편안, 6월까지는 현행', () => {
    expect(isReformBirthMonth('2027-06')).toBe(false)
    expect(isReformBirthMonth('2027-07')).toBe(true)
    expect(isReformBirthMonth('2028-01')).toBe(true)
  })
  it('어린이집 이용 시 현행 금액은 만들지 않는다(원문에 없다)', () => {
    expect(currentPlan({ order: 1, area: 'basic', care: 'daycare' })).toBeNull()
  })
  it('상품권으로 받는 몫: 기본 월 10만 × 13년 = 1,560, 우대 월 15만 × 13년 = 2,340', () => {
    expect(reformPlan({ order: 1, area: 'basic', care: 'home' }).voucherTotal).toBe(1560)
    expect(reformPlan({ order: 1, area: 'priority', care: 'daycare' }).voucherTotal).toBe(2340)
  })
})
