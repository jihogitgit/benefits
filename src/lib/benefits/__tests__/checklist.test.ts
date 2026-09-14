import { describe, it, expect } from 'vitest'
import { buildChecklist, evaluateChecklist } from '../checklist'
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
  it('나이 상한만 없으면 "N세 이상", 하한만 없으면 "N세 이하"', () => {
    expect(buildChecklist({ ...cond, age_min: 65, age_max: null }, null)[0]).toEqual({ key: 'age', label: '만 65세 이상' })
    expect(buildChecklist({ ...cond, age_min: null, age_max: 18 }, null)[0]).toEqual({ key: 'age', label: '만 18세 이하' })
  })
})

describe('evaluateChecklist', () => {
  const items = buildChecklist(cond, null)
  it('진단값으로 항목을 채운다: 확인/불일치/미확인', () => {
    const r = evaluateChecklist(items, cond, { ageBand: '20s', situations: ['job_seeker'], region: 'busan' })
    expect(r.map((x) => x.state)).toEqual(['pass', 'fail', 'unknown', 'pass'])
  })
  it('나이대 범위가 조건과 일부 겹치면 pass', () => {
    const r = evaluateChecklist(items, cond, { ageBand: '30s', situations: [], region: null })
    expect(r[0].state).toBe('pass') // 30~39 ∩ 19~34
    expect(r[1].state).toBe('unknown')
  })
  it('한쪽만 설정된 나이 조건도 평가한다', () => {
    const oneSided = { ...cond, age_min: 65, age_max: null }
    const its = buildChecklist(oneSided, null)
    expect(evaluateChecklist(its, oneSided, { ageBand: '20s', situations: [], region: null })[0].state).toBe('fail')
    expect(evaluateChecklist(its, oneSided, { ageBand: '50s+', situations: [], region: null })[0].state).toBe('pass')
  })
  it('진단이 없으면 모두 unknown', () => {
    expect(evaluateChecklist(items, cond, { ageBand: null, situations: [], region: null }).every((x) => x.state === 'unknown')).toBe(true)
  })
})
