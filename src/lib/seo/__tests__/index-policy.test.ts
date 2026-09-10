import { describe, it, expect } from 'vitest'
import { benefitIndexable, hubIndexable, regionHubIndexable } from '../index-policy'

describe('index policy', () => {
  it('상세: 게재된 해설이 있고 open일 때만 색인', () => {
    expect(benefitIndexable({ status: 'open', article: { review_status: 'published', indexable: true } })).toBe(true)
    expect(benefitIndexable({ status: 'open', article: { review_status: 'stale', indexable: true } })).toBe(true) // stale도 유지
    expect(benefitIndexable({ status: 'open', article: { review_status: 'draft', indexable: false } })).toBe(false)
    expect(benefitIndexable({ status: 'open', article: null })).toBe(false)
    expect(benefitIndexable({ status: 'closed', article: { review_status: 'published', indexable: true } })).toBe(false)
  })
  it('세그먼트 허브는 항상 색인', () => {
    expect(hubIndexable()).toBe(true)
  })
  it('세그먼트×지역: 항목 3개 이상이고 지역 안내문이 있을 때', () => {
    expect(regionHubIndexable({ count: 3, description_md: '서울 안내' })).toBe(true)
    expect(regionHubIndexable({ count: 2, description_md: '서울 안내' })).toBe(false)
    expect(regionHubIndexable({ count: 10, description_md: null })).toBe(false)
    expect(regionHubIndexable({ count: 10, description_md: '  ' })).toBe(false)
  })
})
