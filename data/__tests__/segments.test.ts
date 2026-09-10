import { describe, it, expect } from 'vitest'
import { SEGMENT_BY_PATH, pathOf, PUBLIC_SEGMENTS } from '../segments'

describe('segment path mapping', () => {
  it('URL 경로 ↔ DB 값', () => {
    expect(pathOf('small_biz')).toBe('small-biz')
    expect(pathOf('youth')).toBe('youth')
    expect(SEGMENT_BY_PATH['small-biz']?.slug).toBe('small_biz')
    expect(SEGMENT_BY_PATH['nope']).toBeUndefined()
    // 타입에도 undefined가 남아 있어야 한다(호출자 강제 검사)
    const maybe: typeof SEGMENT_BY_PATH[string] = SEGMENT_BY_PATH['nope']
    expect(maybe?.name).toBeUndefined()
  })
  it('공개 세그먼트는 other를 제외한 3개', () => {
    expect(PUBLIC_SEGMENTS.map((s) => s.slug)).toEqual(['youth', 'parenting', 'small_biz'])
  })
})
