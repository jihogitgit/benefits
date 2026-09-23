import { describe, it, expect } from 'vitest'
import { conditionFilters } from '../condition-filter'
import type { Criteria } from '../search'

const q = (over: Partial<Criteria> = {}): Criteria => ({ ageRange: null, situations: [], region: null, incomeBands: null, ...over })

describe('conditionFilters', () => {
  it('조건이 없으면 필터도 없다', () => {
    expect(conditionFilters(q())).toEqual([])
  })

  it('나이: 조건 없는 행은 통과시키고, 한쪽만 있는 행은 열린 쪽을 경계 없음으로 본다', () => {
    // matchesConditions의 (age_max ?? 120) >= lo && (age_min ?? 0) <= hi 와 같은 판정이다.
    expect(conditionFilters(q({ ageRange: [30, 39] }))).toEqual([
      'and(age_min.is.null,age_max.is.null),age_max.lt.10,and(or(age_max.is.null,age_max.gte.30),or(age_min.is.null,age_min.lte.39))',
    ])
  })

  it('지역: 전국(빈 배열)은 거르지 않는다', () => {
    expect(conditionFilters(q({ region: 'seoul' }))).toEqual(['region_codes.eq.{},region_codes.cs.{seoul}'])
  })

  it('상황: 조건이 없는 행은 통과, 있는 행은 하나라도 맞아야 한다', () => {
    expect(conditionFilters(q({ situations: ['job_seeker'] }))).toEqual([
      'and(life_stages.eq.{},household_types.eq.{},occupations.eq.{},or(age_max.is.null,age_max.gte.10)),occupations.ov.{job_seeker}',
    ])
  })

  it('상황 여러 개는 축별로 합쳐 OR로 묶는다', () => {
    const [f] = conditionFilters(q({ situations: ['has_child', 'single'] }))
    expect(f).toContain('life_stages.ov.{birth,elementary,middle_school,high_school}')
    expect(f).toContain('household_types.ov.{multi_child,single_parent,single}')
    expect(f).not.toContain('occupations.ov.')
  })

  it('축마다 필터를 따로 낸다 (서로 AND로 묶여야 한다)', () => {
    expect(conditionFilters(q({ ageRange: [20, 29], situations: ['single'], region: 'busan' }))).toHaveLength(3)
  })

  it('매핑이 없는 상황만 주면 상황 조건이 있는 행을 전부 거른다', () => {
    // matchesConditions에서 situationHit이 항상 false가 되는 경우와 같은 결과여야 한다.
    expect(conditionFilters(q({ situations: ['알수없음'] }))).toEqual([
      'and(life_stages.eq.{},household_types.eq.{},occupations.eq.{},or(age_max.is.null,age_max.gte.10))',
    ])
  })

  it('필터 문법을 깨뜨릴 값은 거부한다', () => {
    // 지금은 허용목록을 거쳐 들어오지만, 그 전제가 깨지면 조용히 넘기지 않고 터뜨린다.
    expect(() => conditionFilters(q({ region: 'seoul,busan' }))).toThrow(/쓸 수 없는 값/)
    expect(() => conditionFilters(q({ region: 'a}b' }))).toThrow()
  })
})

describe('conditionFilters — 신청자 나이로 읽을 수 없는 구간', () => {
  /*
    SQL 필터와 matchesConditions가 갈라지면 총건수와 목록이 어긋난다.
    영유아 사업(아동수당 0~7세 등)이 다섯 밴드 전부에서 사라지던 문제를 고치면서
    양쪽에 같은 예외를 넣었고, 이 테스트가 SQL 쪽 문구를 고정한다.
  */
  it('상한이 10 미만인 행을 통과시키는 절이 들어간다', () => {
    const [ageFilter] = conditionFilters({ ageRange: [30, 39], situations: [], region: null, incomeBands: null })
    expect(ageFilter).toContain('age_max.lt.10')
  })

  it('나이를 안 고르면 그 절도 없다', () => {
    expect(conditionFilters({ ageRange: null, situations: [], region: null, incomeBands: null })).toEqual([])
  })

  // JS 쪽 isChildTarget과 같은 판정을 SQL로 옮긴 것. 갈라지면 총건수와 목록이 어긋난다.
  describe('대상이 아이인 행', () => {
    it('아이를 키운다고 고르면 나이 상한 조건이 붙는다', () => {
      const [f] = conditionFilters({ ageRange: null, situations: ['has_child'], region: null, incomeBands: null })
      expect(f).toContain('age_max.lt.10')
    })

    it('다른 상황에서는 나이 상한 조건이 붙지 않는다', () => {
      const [f] = conditionFilters({ ageRange: null, situations: ['job_seeker'], region: null, incomeBands: null })
      expect(f).not.toContain('age_max.lt.10')
    })

    // 이 조건이 빠지면 영유아 사업이 아무 상황에나 '조건 없음'으로 통과한다.
    it('조건 없음 절에 나이 상한이 함께 걸린다', () => {
      const [f] = conditionFilters({ ageRange: null, situations: ['single'], region: null, incomeBands: null })
      expect(f).toContain('or(age_max.is.null,age_max.gte.10)')
    })
  })
})
