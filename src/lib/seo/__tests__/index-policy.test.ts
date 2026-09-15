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
  it('세그먼트×지역: 그 지역에만 있는 항목이 10개 이상이고 안내문이 있을 때', () => {
    expect(regionHubIndexable({ localCount: 10, description_md: '서울 안내' })).toBe(true)
    expect(regionHubIndexable({ localCount: 9, description_md: '서울 안내' })).toBe(false)
    expect(regionHubIndexable({ localCount: 50, description_md: null })).toBe(false)
    expect(regionHubIndexable({ localCount: 50, description_md: '  ' })).toBe(false)
  })
  it('전국 공통 건수는 판정에 넣지 않는다 (doorway page 방지)', () => {
    // 전국분이 청년 183·출산육아 473·소상공인 478건이라 이걸 더하면 임계값이 항상 통과된다.
    // 실제로 광주는 지역 전용이 1/0/0인데도 전국분 덕에 3페이지가 모두 색인 대상이 됐다.
    // 지역명만 갈아끼운 사실상 같은 페이지 51개를 색인시키는 doorway page 패턴이다.
    expect(regionHubIndexable({ localCount: 1, description_md: '광주 안내' })).toBe(false)
    expect(regionHubIndexable({ localCount: 0, description_md: '광주 안내' })).toBe(false)
  })
})
