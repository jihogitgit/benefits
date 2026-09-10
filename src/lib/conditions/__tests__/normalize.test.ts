import { describe, it, expect } from 'vitest'
import { normalizeConditions } from '../normalize'

describe('normalizeConditions', () => {
  it('성별 코드 → gender', () => {
    expect(normalizeConditions({ 서비스ID: 'a', JA0101: 'Y' }).gender).toBe('male')
    expect(normalizeConditions({ 서비스ID: 'a', JA0102: 'Y' }).gender).toBe('female')
    expect(normalizeConditions({ 서비스ID: 'a', JA0101: 'Y', JA0102: 'Y' }).gender).toBe('any')
    expect(normalizeConditions({ 서비스ID: 'a' }).gender).toBe('any')
  })
  it('나이 범위 코드 → age_min/age_max (문자·숫자 모두)', () => {
    const r = normalizeConditions({ 서비스ID: 'a', JA0110: '19', JA0111: 34 })
    expect(r.age_min).toBe(19)
    expect(r.age_max).toBe(34)
  })
  it('빈 나이는 null', () => {
    const r = normalizeConditions({ 서비스ID: 'a', JA0110: '', JA0111: null })
    expect(r.age_min).toBeNull()
    expect(r.age_max).toBeNull()
  })
  it('소득·생애주기·가구·직업 코드를 배열로 매핑한다', () => {
    const r = normalizeConditions({ 서비스ID: 'a', JA0201: 'Y', JA0302: 'Y', JA0327: 'Y', JA0404: 'Y' })
    expect(r.income_bands).toEqual(['0-50'])
    expect(r.life_stages).toEqual(['pregnancy'])
    expect(r.occupations).toEqual(['job_seeker'])
    expect(r.household_types).toEqual(['single'])
  })
  it('null 값 코드는 켜지지 않는다', () => {
    const r = normalizeConditions({ 서비스ID: 'a', JA0302: null, JA0404: 'Y' })
    expect(r.life_stages).toEqual([])
    expect(r.household_types).toEqual(['single'])
  })
  it('그룹의 모든 코드가 Y면 제한 없음으로 보고 조건을 넣지 않는다 (실데이터 규약)', () => {
    const allHousehold = Object.fromEntries(['JA0401', 'JA0402', 'JA0403', 'JA0404', 'JA0410', 'JA0411', 'JA0412', 'JA0413', 'JA0414'].map((c) => [c, 'Y']))
    const allIncome = Object.fromEntries(['JA0201', 'JA0202', 'JA0203', 'JA0204', 'JA0205'].map((c) => [c, 'Y']))
    const r = normalizeConditions({ 서비스ID: 'a', ...allHousehold, ...allIncome, JA0302: 'Y', JA0301: null })
    expect(r.household_types).toEqual([])
    expect(r.income_bands).toEqual([])
    expect(r.life_stages).toEqual(['pregnancy']) // JA03 그룹은 일부만 Y → 조건 유지
  })
  it('그룹 중 일부만 Y면 그 값들만 조건이 된다', () => {
    const r = normalizeConditions({ 서비스ID: 'a', JA0401: null, JA0403: 'Y', JA0404: 'Y', JA0410: null })
    expect(r.household_types).toEqual(['single_parent', 'single'])
  })
  it('알 수 없는 JA 코드는 무시하고 unknownCodes에 담는다', () => {
    const r = normalizeConditions({ 서비스ID: 'a', JA9999: 'Y' })
    expect(r.unknownCodes).toEqual(['JA9999'])
  })
})
