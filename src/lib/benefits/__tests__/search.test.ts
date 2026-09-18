import { describe, it, expect } from 'vitest'
import { parseSearchParams, ageBandToRange, matchesConditions, matchScore, rankBenefits, cacheKeyFor, titleHitBonus } from '../search'

describe('parseSearchParams', () => {
  it('쿼리스트링을 검색 입력으로', () => {
    const p = parseSearchParams(new URLSearchParams('age=30s&situations=pregnancy,single&region=seoul&count=1'))
    expect(p).toEqual({ q: '', ageBand: '30s', situations: ['pregnancy', 'single'], region: 'seoul', countOnly: true, limit: 50, offset: 0 })
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

  /*
    원천은 JA0110/JA0111에 '대상자' 나이를 담는데 영유아 사업은 그 대상자가 아이다.
    아동수당이 0~7세로 들어와 10대~50대 이상 다섯 밴드 전부에서 탈락했다 — 거르는 게
    아니라 레코드를 지웠다. 이런 행이 진행 중인 것만 198건이고 전부 parenting이었다.
  */
  it('상한이 10대 밑이면 신청자 나이로 읽지 않는다 — 아동수당이 모든 밴드에서 사라졌었다', () => {
    const childAge = { ...cond, age_min: 0, age_max: 7, life_stages: [] }
    for (const band of [[10, 19], [20, 29], [30, 39], [40, 49], [50, 120]] as [number, number][])
      expect(matchesConditions(childAge, { ageRange: band, situations: [], region: null })).toBe(true)
    // 나이로 가점도 하지 않는다. 신청자 나이가 아니니 맞물렸다고 볼 수 없다.
    expect(matchScore(childAge, { ageRange: [30, 39], situations: [], region: null })).toBe(0)
  })

  it('경계: 상한 9는 신청자 나이가 아니고, 10은 신청자 나이다', () => {
    const nine = { ...cond, age_min: 0, age_max: 9 }
    const ten = { ...cond, age_min: 0, age_max: 10 }
    expect(matchesConditions(nine, { ageRange: [30, 39], situations: [], region: null })).toBe(true)
    expect(matchesConditions(ten, { ageRange: [30, 39], situations: [], region: null })).toBe(false)
    expect(matchesConditions(ten, { ageRange: [10, 19], situations: [], region: null })).toBe(true)
  })

  it('청소년 대상 사업은 그대로 걸러진다 — 상한 18은 10대와만 겹친다', () => {
    const teen = { ...cond, age_min: 13, age_max: 18 }
    expect(matchesConditions(teen, { ageRange: [10, 19], situations: [], region: null })).toBe(true)
    expect(matchesConditions(teen, { ageRange: [30, 39], situations: [], region: null })).toBe(false)
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
  const base = { q: '', ageBand: '30s' as const, situations: ['single', 'pregnancy'], region: 'seoul', countOnly: false, limit: 50, offset: 0 }
  it('입력 순서와 무관하게 같은 키', () => {
    const a = cacheKeyFor(base)
    const b = cacheKeyFor({ ...base, situations: ['pregnancy', 'single'] })
    expect(a).toBe(b)
  })
  it('검색어가 다르면 키도 다르다', () => {
    // 검색어를 키에 안 넣으면 캐시가 다른 검색어의 결과를 그대로 돌려준다.
    expect(cacheKeyFor({ ...base, q: '월세' })).not.toBe(cacheKeyFor(base))
    expect(cacheKeyFor({ ...base, q: '월세' })).not.toBe(cacheKeyFor({ ...base, q: '창업' }))
  })
})

describe('titleHitBonus', () => {
  it('모든 토큰이 제목에 있으면 가점, 하나라도 없으면 0', () => {
    expect(titleHitBonus('청년월세 특별지원', ['청년', '월세'])).toBe(2)
    expect(titleHitBonus('청년 창업 지원', ['청년', '월세'])).toBe(0)
  })
  it('검색어가 없으면 가점도 없다 (필터만 쓴 결과 순서를 흔들지 않는다)', () => {
    expect(titleHitBonus('아무 제목', [])).toBe(0)
  })
  it('영문은 대소문자를 가리지 않는다', () => {
    expect(titleHitBonus('K-Digital Training', ['k-digital'.replace('-', ''), 'training'])).toBe(0)
    expect(titleHitBonus('K Digital Training', ['digital', 'TRAINING'])).toBe(2)
  })
})

describe('검색어 랭킹', () => {
  it('제목이 걸린 항목이 기관명만 걸린 항목보다 앞선다', () => {
    const rows = [
      { slug: 'b', deadline_type: 'always', apply_end: null, hasConditions: true, score: 0 + titleHitBonus('국세청 다른 지원', ['근로장려금']) },
      { slug: 'a', deadline_type: 'always', apply_end: null, hasConditions: true, score: 0 + titleHitBonus('근로장려금', ['근로장려금']) },
    ]
    expect(rankBenefits(rows, new Date('2026-09-16')).map((r) => r.slug)).toEqual(['a', 'b'])
  })
})
