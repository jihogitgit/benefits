import { describe, it, expect } from 'vitest'
import { slugify, allocateSlug } from '../slug'

describe('slugify', () => {
  it('한글은 유지하고 공백은 하이픈, 특수문자는 제거한다', () => {
    expect(slugify('서울시 임산부 교통비 지원(70만원)')).toBe('서울시-임산부-교통비-지원-70만원')
  })
  it('연속 하이픈과 양끝 하이픈을 정리한다', () => {
    expect(slugify('  청년   월세 -- 특별지원 ')).toBe('청년-월세-특별지원')
  })
  it('60자를 넘지 않는다', () => {
    expect(slugify('가'.repeat(100)).length).toBeLessThanOrEqual(60)
  })
})

describe('allocateSlug', () => {
  it('충돌이 없으면 그대로', () => {
    const used = new Set<string>()
    expect(allocateSlug('청년-월세', used)).toBe('청년-월세')
    expect(used.has('청년-월세')).toBe(true)
  })
  it('충돌하면 -2, -3 접미를 붙인다', () => {
    const used = new Set(['청년-월세', '청년-월세-2'])
    expect(allocateSlug('청년-월세', used)).toBe('청년-월세-3')
  })
})
