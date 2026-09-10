import { describe, it, expect } from 'vitest'
import { tagSegments } from '../rules'

const base = { title: '', target_text: '', summary: '' }
const noCond = { age_min: null, age_max: null, life_stages: [], occupations: [], household_types: [] }

describe('tagSegments', () => {
  it('청년: 나이 조건 19~39 범위 안', () => {
    expect(tagSegments(base, { ...noCond, age_min: 19, age_max: 34 })).toContain('youth')
  })
  it('청년: 키워드', () => {
    expect(tagSegments({ ...base, title: '청년 월세 특별지원' }, noCond)).toContain('youth')
  })
  it('나이 범위가 넓거나 미성년 시작이면 청년 아님', () => {
    expect(tagSegments(base, { ...noCond, age_min: 0, age_max: 100 })).not.toContain('youth')
    expect(tagSegments(base, { ...noCond, age_min: 3, age_max: 5 })).not.toContain('youth')
    expect(tagSegments(base, { ...noCond, age_min: 15, age_max: 24 })).not.toContain('youth')
  })
  it('출산·육아: 생애주기 코드, 아동 나이 범위, 또는 키워드', () => {
    expect(tagSegments(base, { ...noCond, life_stages: ['pregnancy'] })).toContain('parenting')
    expect(tagSegments(base, { ...noCond, age_min: 3, age_max: 5 })).toContain('parenting')
    expect(tagSegments({ ...base, target_text: '만 0~5세 영유아 양육 가정' }, noCond)).toContain('parenting')
  })
  it('한부모·다자녀 가구 유형만으로는 출산·육아로 보지 않는다', () => {
    expect(tagSegments({ ...base, title: '무인민원발급기 수수료 면제' }, { ...noCond, household_types: ['single_parent', 'multi_child', 'disabled'] })).toEqual(['other'])
  })
  it('소상공인: 직업 코드 또는 키워드', () => {
    expect(tagSegments(base, { ...noCond, occupations: ['small_biz'] })).toContain('small_biz')
    expect(tagSegments({ ...base, title: '소상공인 냉난방기 교체 지원' }, noCond)).toContain('small_biz')
    expect(tagSegments({ ...base, summary: '자영업자 경영안정자금' }, noCond)).toContain('small_biz')
  })
  it('복수 세그먼트 가능, 없으면 other', () => {
    expect(tagSegments({ ...base, title: '청년 창업 소상공인 지원' }, noCond)).toEqual(['youth', 'small_biz'])
    expect(tagSegments({ ...base, title: '노인 기초연금' }, noCond)).toEqual(['other'])
  })
})
