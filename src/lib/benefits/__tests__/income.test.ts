import { describe, it, expect } from 'vitest'
import { medianIncomePercent, bandOf, eligibleBands, amountAt, isSupportedHousehold, INCOME_BANDS } from '../income'
import { MEDIAN_INCOME_2026, MEDIAN_INCOME_ANCHORS } from '../../../../data/median-income'
import { CODEMAP } from '@/lib/conditions/codemap'

describe('기준 중위소득 표', () => {
  it('보도자료가 적은 증가율이 표 값에서 재현된다', () => {
    // 2025년 값은 같은 보도자료 표에서 왔다. 두 해 값이 함께 맞아야 옮겨 적기가 맞은 것이다.
    const y25: Record<number, number> = { 1: 2_392_013, 2: 3_932_658, 4: 6_097_773 }
    const rate = (n: number) => Math.round((MEDIAN_INCOME_2026[n] / y25[n] - 1) * 10000) / 100
    expect(rate(1)).toBe(7.2)
    expect(rate(2)).toBe(6.78)
    expect(rate(4)).toBe(6.51)
  })

  it('가구원 수가 늘면 금액도 는다', () => {
    for (let n = 2; n <= 6; n++) expect(MEDIAN_INCOME_2026[n]).toBeGreaterThan(MEDIAN_INCOME_2026[n - 1])
  })

  it('7인 이상은 답하지 않는다', () => {
    expect(isSupportedHousehold(6)).toBe(true)
    expect(isSupportedHousehold(7)).toBe(false)
    expect(medianIncomePercent(1_000_000, 7)).toBeNull()
    expect(amountAt(7, 50)).toBeNull()
  })
})

describe('구간 판정', () => {
  it('4인 가구 소득이 중위소득과 같으면 100%', () => {
    expect(medianIncomePercent(MEDIAN_INCOME_2026[4], 4)).toBe(100)
  })

  it('절반이면 50%이고 0-50 구간이다', () => {
    const half = MEDIAN_INCOME_2026[4] / 2
    expect(medianIncomePercent(half, 4)).toBe(50)
    expect(bandOf(50)).toBe('0-50')
  })

  it('코드가 비워 둔 50~51 사이는 위 구간으로 올린다', () => {
    // 구간은 사업이 정한 상한이다. 50.4%를 0-50에 넣으면 '50% 이하' 사업을 받을 수 있다고
    // 말하게 되는데 실제로는 못 받는다.
    expect(bandOf(50)).toBe('0-50')
    expect(bandOf(50.1)).toBe('51-75')
    expect(bandOf(50.4)).toBe('51-75')
    expect(bandOf(75)).toBe('51-75')
    expect(bandOf(100)).toBe('76-100')
    expect(bandOf(200)).toBe('101-200')
    expect(bandOf(200.1)).toBe('200+')
  })

  it('내 구간보다 위쪽 구간까지 자격이 된다', () => {
    // 50% 이하인 사람은 '75% 이하' 사업도 받는다. 자기 구간만 보면 가장 가난한 사람에게
    // 가장 적은 결과가 나온다.
    expect(eligibleBands('0-50')).toEqual(['0-50', '51-75', '76-100', '101-200', '200+'])
    expect(eligibleBands('101-200')).toEqual(['101-200', '200+'])
    expect(eligibleBands('200+')).toEqual(['200+'])
  })

  it('소득이 0이어도, 음수면 답하지 않는다', () => {
    expect(medianIncomePercent(0, 1)).toBe(0)
    expect(medianIncomePercent(-1, 1)).toBeNull()
  })
})

describe('조건 코드와의 연결', () => {
  it('구간 문자열이 codemap의 소득 코드 값과 정확히 같다', () => {
    // 여기가 어긋나면 계산 결과가 어떤 지원금과도 안 맞고, 화면은 조용히 0건을 낸다.
    const fromCodemap = Object.values(CODEMAP)
      .filter((v): v is { kind: 'income'; value: string } => v.kind === 'income')
      .map((v) => v.value)
      .sort()
    expect([...INCOME_BANDS].sort()).toEqual(fromCodemap.sort())
  })
})

describe('기준선 금액', () => {
  it('보도자료가 명시한 제도 비율만 싣는다', () => {
    // 임의 눈금을 넣으면 사용자가 존재하지 않는 기준을 읽는다.
    const pcts = MEDIAN_INCOME_ANCHORS.map((a) => a.pct)
    expect(pcts).toEqual([32, 40, 48, 50, 60, 100, 120, 200, 300])
  })

  it('1인 가구 생계급여(32%)가 보도자료의 82만 556원과 맞는다', () => {
    // 보도자료 본문: "1인 가구 기준으로 급여별 선정기준은 생계급여 82만 556원"
    expect(amountAt(1, 32)).toBe(820_556)
  })

  it('1인 가구 의료급여(40%)가 보도자료의 102만 5,695원과 맞는다', () => {
    expect(amountAt(1, 40)).toBe(1_025_695)
  })
})
