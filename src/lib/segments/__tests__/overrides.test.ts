import { describe, it, expect } from 'vitest'
import { applySegmentOverrides, SEGMENT_ADDITIONS } from '../overrides'
import { normalizeBenefit } from '@/lib/sync/normalize'
import type { ServiceListItem } from '@/lib/api/gov24-schema'

describe('세그먼트 보정표', () => {
  const [id, entry] = Object.entries(SEGMENT_ADDITIONS)[0] ?? []

  it('표에 없는 사업은 그대로 둔다', () => {
    expect(applySegmentOverrides('no-such-id', ['other'])).toEqual(['other'])
    expect(applySegmentOverrides(null, ['youth'])).toEqual(['youth'])
  })

  it.runIf(!!id)('더한 세그먼트가 생기면 other를 뗀다', () => {
    const out = applySegmentOverrides(id, ['other'])
    expect(out).not.toContain('other')
    for (const s of entry!.add) expect(out).toContain(s)
  })

  it.runIf(!!id)('규칙이 준 세그먼트는 빼지 않는다', () => {
    expect(applySegmentOverrides(id, ['parenting'])).toContain('parenting')
  })

  // 동기화가 보정표를 거치지 않으면 원천이 수정될 때마다 보정분이 조용히 사라진다.
  it.runIf(!!id)('동기화 정규화가 보정표를 거친다', () => {
    const item = { 서비스ID: id, 서비스명: '아무 제목', 소관기관명: '국토교통부' } as unknown as ServiceListItem
    const row = normalizeBenefit(item, null, 'x', new Date('2026-09-28T00:00:00Z'))
    for (const s of entry!.add) expect(row.segments).toContain(s)
  })

  it('모든 항목이 근거를 적고 공개 세그먼트만 더한다', () => {
    for (const [, e] of Object.entries(SEGMENT_ADDITIONS)) {
      expect(e.why.length).toBeGreaterThan(20)
      expect(e.add).not.toContain('other')
    }
  })
})
