import { describe, it, expect } from 'vitest'
import { buildChecklist, evaluateChecklist, summarize, isUnjudgeable } from '../checklist'
import type { ConditionJoin } from '../queries'

const cond: ConditionJoin = {
  age_min: 19,
  age_max: 34,
  gender: 'any',
  income_bands: [],
  life_stages: [],
  household_types: ['no_house'],
  occupations: ['job_seeker'],
  region_codes: ['seoul'],
}

describe('buildChecklist', () => {
  it('조건 행에서 체크 항목을 만든다 (나이·지역·가구·직업)', () => {
    const items = buildChecklist(cond, null)
    expect(items.map((i) => i.key)).toEqual(['age', 'region', 'household:no_house', 'occupation:job_seeker'])
    expect(items[0].label).toBe('만 19~34세')
    expect(items[1].label).toBe('서울 거주')
    expect(items[2].label).toBe('무주택 세대')
    expect(items[3].label).toBe('구직자·실업자')
  })
  it('검수된 체크리스트가 있으면 그것을 우선한다', () => {
    const items = buildChecklist(cond, [{ label: '서울 6개월 이상 거주', condition_key: 'region' }])
    expect(items).toEqual([{ key: 'region', label: '서울 6개월 이상 거주' }])
  })
  it('조건이 없으면 빈 배열', () => {
    expect(buildChecklist(null, null)).toEqual([])
  })
  it('전 연령(0~제한없음)은 체크 항목으로 만들지 않는다', () => {
    expect(buildChecklist({ ...cond, age_min: 0, age_max: 120 }, null).map((i) => i.key)).not.toContain('age')
    expect(buildChecklist({ ...cond, age_min: 0, age_max: null }, null).map((i) => i.key)).not.toContain('age')
    expect(buildChecklist({ ...cond, age_min: 0, age_max: 18 }, null).map((i) => i.key)).toContain('age')
  })
  it('나이 상한만 없으면 "N세 이상", 하한만 없으면 "N세 이하"', () => {
    expect(buildChecklist({ ...cond, age_min: 65, age_max: null }, null)[0]).toEqual({ key: 'age', label: '만 65세 이상' })
    expect(buildChecklist({ ...cond, age_min: null, age_max: 18 }, null)[0]).toEqual({ key: 'age', label: '만 18세 이하' })
  })
})

describe('summarize', () => {
  it('부분 겹침이 있으면 "바로 신청" 문구를 내보내지 않는다', () => {
    const ev = [
      { key: 'age', label: '만 65세 이상', state: 'partial' as const },
      { key: 'region', label: '서울 거주', state: 'pass' as const },
    ]
    const s = summarize(ev)
    expect(s).not.toMatch(/바로 신청/)
    expect(s).toMatch(/2개 중 1개 충족/)
  })
  it('판정할 항목이 없을 때, 진단을 이미 채웠으면 "홈에서 고르면"이라 하지 않는다', () => {
    const ev = [{ key: 'income:0-50', label: '중위소득 50% 이하', state: 'unknown' as const }]
    expect(summarize(ev, true)).toMatch(/홈에서 조건을 고르면/)
    expect(summarize(ev, false)).not.toMatch(/홈에서 조건을 고르면/)
    expect(summarize(ev, false)).toMatch(/자동 판정할 수 있는 항목이 없습니다/)
  })
  it('전부 pass 일 때만 "바로 신청"', () => {
    expect(summarize([{ key: 'region', label: '서울 거주', state: 'pass' as const }])).toMatch(/바로 신청/)
  })
})

describe('evaluateChecklist', () => {
  const items = buildChecklist(cond, null)
  it('진단값으로 항목을 채운다: 확인/불일치/미확인', () => {
    const r = evaluateChecklist(items, cond, { ageBand: '20s', situations: ['job_seeker'], region: 'busan' })
    expect(r.map((x) => x.state)).toEqual(['pass', 'fail', 'unknown', 'pass'])
  })
  it('나이대가 조건에 완전히 들어가면 pass, 일부만 겹치면 partial', () => {
    // 진단은 10년 단위라 정확한 나이를 모른다. 겹치기만 해도 '충족'으로 체크하면
    // 50세 사용자가 '만 65세 이상'에 자격이 있다고 오인한다(age_min>=60 조건이 858건).
    expect(evaluateChecklist(items, cond, { ageBand: '20s', situations: [], region: null })[0].state).toBe('pass') // [20,29] ⊆ [19,34]
    const r = evaluateChecklist(items, cond, { ageBand: '30s', situations: [], region: null })
    expect(r[0].state).toBe('partial') // [30,39] ∩ [19,34] ≠ ∅ 이지만 35~39는 벗어난다
    expect(r[1].state).toBe('unknown')
  })
  it('겹치지 않으면 fail', () => {
    expect(evaluateChecklist(items, cond, { ageBand: '50s+', situations: [], region: null })[0].state).toBe('fail')
  })
  it('한쪽만 설정된 나이 조건도 평가한다', () => {
    const oneSided = { ...cond, age_min: 65, age_max: null }
    const its = buildChecklist(oneSided, null)
    expect(evaluateChecklist(its, oneSided, { ageBand: '20s', situations: [], region: null })[0].state).toBe('fail')
    // [50,120] 은 [65,120] 을 벗어나는 50~64를 포함하므로 partial 이다
    expect(evaluateChecklist(its, oneSided, { ageBand: '50s+', situations: [], region: null })[0].state).toBe('partial')
  })
  it('진단이 없으면 모두 unknown', () => {
    expect(evaluateChecklist(items, cond, { ageBand: null, situations: [], region: null }).every((x) => x.state === 'unknown')).toBe(true)
  })
})

describe('isUnjudgeable', () => {
  it('성별·소득은 진단으로 판정할 수 없다', () => {
    expect(isUnjudgeable('gender')).toBe(true)
    expect(isUnjudgeable('income:0-50|51-75')).toBe(true)
  })
  it('나이·지역·상황은 판정할 수 있다', () => {
    expect(isUnjudgeable('age')).toBe(false)
    expect(isUnjudgeable('region')).toBe(false)
    expect(isUnjudgeable('occupation:job_seeker')).toBe(false)
  })
})
