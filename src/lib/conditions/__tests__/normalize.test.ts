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

describe('normalizeConditions — 가구유형 코드 정렬 (JA0410~JA0414 밀림 수정)', () => {
  // 원천 데이터 역산 결과: JA0411이 다자녀, JA0412가 무주택, JA0413이 신규전입이다.
  // 예전 코드맵은 한 칸씩 당겨 있어 다자녀 지원금 104건이 '무주택'으로 분류됐고,
  // 진단에서 무주택을 고르면 다자녀·출산 지원금이 상위를 채웠다.
  it('JA0411은 다자녀다', () => {
    expect(normalizeConditions({ 서비스ID: 'a', JA0411: 'Y' }).household_types).toEqual(['multi_child'])
  })

  it('JA0412는 무주택이다', () => {
    expect(normalizeConditions({ 서비스ID: 'a', JA0412: 'Y' }).household_types).toEqual(['no_house'])
  })

  it('JA0413은 신규전입이다', () => {
    expect(normalizeConditions({ 서비스ID: 'a', JA0413: 'Y' }).household_types).toEqual(['new_resident'])
  })

  // 무주택을 고른 사용자에게 다자녀 지원금이 가지 않아야 한다 — 이 회귀가 실제로 있었다
  it('다자녀 코드만 켠 행은 무주택으로 분류되지 않는다', () => {
    expect(normalizeConditions({ 서비스ID: 'a', JA0411: 'Y' }).household_types).not.toContain('no_house')
  })

  it('JA0410은 가구유형으로 쓰지 않는다', () => {
    expect(normalizeConditions({ 서비스ID: 'a', JA0410: 'Y' }).household_types).toEqual([])
  })
})

describe('normalizeConditions — 제한 없음 임계값(2/3)', () => {
  const J4 = ['JA0401', 'JA0402', 'JA0403', 'JA0404', 'JA0410', 'JA0411', 'JA0412', 'JA0413', 'JA0414']
  const on = (codes: string[]) => Object.fromEntries(codes.map((c) => [c, 'Y']))

  // 9개 중 7~8개만 켠 행이 원천에 131건 있다. 이걸 조건으로 읽으면 어떤 상황을 골라도
  // 매칭돼 점수 만점을 받고 모든 진단의 최상단을 차지한다.
  it('9개 중 7개가 켜지면 제한 없음으로 본다', () => {
    const r = normalizeConditions({ 서비스ID: 'a', ...on(J4.slice(0, 7)) })
    expect(r.household_types).toEqual([])
  })

  it('9개 중 6개(2/3)가 켜지면 제한 없음으로 본다', () => {
    const r = normalizeConditions({ 서비스ID: 'a', ...on(J4.slice(0, 6)) })
    expect(r.household_types).toEqual([])
  })

  // 진짜로 좁게 지정한 행은 그대로 남아야 한다. 임계값을 너무 낮추면 조건이 통째로 사라진다
  it('9개 중 5개까지는 조건으로 남긴다', () => {
    const r = normalizeConditions({ 서비스ID: 'a', ...on(['JA0401', 'JA0402', 'JA0403', 'JA0411', 'JA0412']) })
    expect(r.household_types.sort()).toEqual(['defector', 'multi_child', 'multicultural', 'no_house', 'single_parent'])
  })

  it('한두 개만 켠 흔한 경우는 영향받지 않는다', () => {
    expect(normalizeConditions({ 서비스ID: 'a', JA0403: 'Y' }).household_types).toEqual(['single_parent'])
  })

  // 성별은 코드가 2개뿐이라 2/3 올림이 2다. 한쪽만 켜면 그대로 그 성별이어야 한다
  it('성별은 한쪽만 켜면 여전히 그 성별이다', () => {
    expect(normalizeConditions({ 서비스ID: 'a', JA0101: 'Y' }).gender).toBe('male')
  })
})
