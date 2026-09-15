import { describe, it, expect } from 'vitest'
import { parseSearchParams, ageBandToRange, matchesConditions, matchScore, rankBenefits, cacheKeyFor } from '../search'

describe('parseSearchParams', () => {
  it('쿼리스트링을 검색 입력으로', () => {
    const p = parseSearchParams(new URLSearchParams('age=30s&situations=pregnancy,single&region=seoul&count=1'))
    expect(p).toEqual({ ageBand: '30s', situations: ['pregnancy', 'single'], region: 'seoul', countOnly: true, limit: 50, offset: 0 })
  })
  it('허용되지 않은 값은 버린다', () => {
    const p = parseSearchParams(new URLSearchParams('age=99s&situations=x,job_seeker&region=mars&limit=999&offset=-3'))
    expect(p.ageBand).toBeNull()
    expect(p.situations).toEqual(['job_seeker'])
    expect(p.region).toBeNull()
    expect(p.limit).toBe(100)
    expect(p.offset).toBe(0)
  })
})

describe('ageBandToRange', () => {
  it('10s~50s+', () => {
    expect(ageBandToRange('10s')).toEqual([10, 19])
    expect(ageBandToRange('30s')).toEqual([30, 39])
    expect(ageBandToRange('50s+')).toEqual([50, 120])
    expect(ageBandToRange(null)).toBeNull()
  })
})

describe('matchesConditions', () => {
  const cond = { age_min: 19, age_max: 34, gender: 'any' as const, life_stages: ['pregnancy'], household_types: [], occupations: [], region_codes: ['seoul'] }
  it('나이 범위 겹치면 통과', () => {
    expect(matchesConditions(cond, { ageRange: [30, 39], situations: [], region: null })).toBe(true)
    expect(matchesConditions(cond, { ageRange: [40, 49], situations: [], region: null })).toBe(false)
  })
  it('한쪽만 설정된 나이 조건도 거른다', () => {
    const onlyMin = { ...cond, age_min: 65, age_max: null }
    expect(matchesConditions(onlyMin, { ageRange: [20, 29], situations: [], region: null })).toBe(false)
    expect(matchesConditions(onlyMin, { ageRange: [50, 120], situations: [], region: null })).toBe(true)
    const onlyMax = { ...cond, age_min: null, age_max: 18 }
    expect(matchesConditions(onlyMax, { ageRange: [20, 29], situations: [], region: null })).toBe(false)
    expect(matchesConditions(onlyMax, { ageRange: [10, 19], situations: [], region: null })).toBe(true)
  })
  it('나이 조건이 없는 항목은 나이로 거르지 않는다', () => {
    expect(matchesConditions({ ...cond, age_min: null, age_max: null }, { ageRange: [40, 49], situations: [], region: null })).toBe(true)
  })
  it('상황은 하나라도 일치하면 통과, 상황 조건이 없는 항목은 통과', () => {
    expect(matchesConditions(cond, { ageRange: null, situations: ['pregnancy'], region: null })).toBe(true)
    expect(matchesConditions(cond, { ageRange: null, situations: ['job_seeker'], region: null })).toBe(false)
    expect(matchesConditions(cond, { ageRange: null, situations: ['job_seeker', 'pregnancy'], region: null })).toBe(true)
    expect(matchesConditions({ ...cond, life_stages: [] }, { ageRange: null, situations: ['job_seeker'], region: null })).toBe(true)
  })
  it('지역은 일치 또는 전국(빈 배열)', () => {
    expect(matchesConditions(cond, { ageRange: null, situations: [], region: 'seoul' })).toBe(true)
    expect(matchesConditions(cond, { ageRange: null, situations: [], region: 'busan' })).toBe(false)
    expect(matchesConditions({ ...cond, region_codes: [] }, { ageRange: null, situations: [], region: 'busan' })).toBe(true)
  })
})

describe('matchScore', () => {
  const base = { age_min: null, age_max: null, gender: 'any' as const, life_stages: [], household_types: [], occupations: [], region_codes: [] }
  const q = { ageRange: [20, 29] as [number, number], situations: ['job_seeker'], region: 'seoul' }
  it('상황 일치 +2, 지역 일치 +1, 나이 조건 일치 +1', () => {
    expect(matchScore({ ...base, occupations: ['job_seeker'], region_codes: ['seoul'], age_min: 19, age_max: 34 }, q)).toBe(4)
    expect(matchScore({ ...base, region_codes: ['seoul'] }, q)).toBe(1)
    expect(matchScore(base, q)).toBe(0)
    expect(matchScore(null, q)).toBe(0)
  })
  it('나이 구간이 겹치지 않으면 가점하지 않는다 (사전 필터 없이 단독 호출돼도)', () => {
    // export된 함수라 matchesConditions 통과를 전제할 수 없다. 스스로 일치를 확인해야
    // 향후 호출부(추천 레일 등)가 20대에게 70대 전용 지원금을 가점하지 않는다.
    expect(matchScore({ ...base, age_min: 70, age_max: 79 }, q)).toBe(0)
    expect(matchScore({ ...base, age_min: 65, age_max: null }, q)).toBe(0)
    expect(matchScore({ ...base, age_min: null, age_max: 18 }, q)).toBe(0)
    expect(matchScore({ ...base, age_min: 25, age_max: 35 }, q)).toBe(1)
  })
  it('사용자가 상황을 고르지 않았으면 상황 점수를 주지 않는다', () => {
    expect(matchScore({ ...base, occupations: ['job_seeker'] }, { ageRange: null, situations: [], region: null })).toBe(0)
  })
  it('전국(region_codes 빈 배열) 항목은 지역 점수를 못 받는다', () => {
    expect(matchScore(base, { ageRange: null, situations: [], region: 'seoul' })).toBe(0)
  })
})

describe('rankBenefits', () => {
  it('마감 임박 → 상시 → 조건 확인 필요 순', () => {
    const rows = [
      { slug: 'always', deadline_type: 'always', apply_end: null, hasConditions: true, score: 0 },
      { slug: 'soon', deadline_type: 'period', apply_end: '2026-09-15', hasConditions: true, score: 0 },
      { slug: 'unknown', deadline_type: 'unknown', apply_end: null, hasConditions: false, score: 0 },
      { slug: 'later', deadline_type: 'period', apply_end: '2026-10-15', hasConditions: true, score: 0 },
    ]
    expect(rankBenefits(rows, new Date('2026-09-10T03:00:00Z')).map((r) => r.slug)).toEqual(['soon', 'later', 'always', 'unknown'])
  })

  it('점수 높은 항목이 먼저, 같은 점수 안에서 마감 임박 → 상시 → 조건 확인 필요', () => {
    const rows = [
      { slug: 'generic-soon', deadline_type: 'period', apply_end: '2026-09-15', hasConditions: true, score: 0 },
      { slug: 'match-always', deadline_type: 'always', apply_end: null, hasConditions: true, score: 3 },
      { slug: 'match-soon', deadline_type: 'period', apply_end: '2026-09-20', hasConditions: true, score: 3 },
      { slug: 'unsure', deadline_type: 'unknown', apply_end: null, hasConditions: false, score: 0 },
    ]
    expect(rankBenefits(rows, new Date('2026-09-10T03:00:00Z')).map((r) => r.slug)).toEqual(['match-soon', 'match-always', 'generic-soon', 'unsure'])
  })
})

describe('cacheKeyFor', () => {
  it('입력 순서와 무관하게 같은 키', () => {
    const a = cacheKeyFor({ ageBand: '30s', situations: ['single', 'pregnancy'], region: 'seoul', countOnly: false, limit: 50, offset: 0 })
    const b = cacheKeyFor({ ageBand: '30s', situations: ['pregnancy', 'single'], region: 'seoul', countOnly: false, limit: 50, offset: 0 })
    expect(a).toBe(b)
  })
})
