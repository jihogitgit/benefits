import { describe, it, expect } from 'vitest'
import { SITUATION_OPTIONS, AGE_OPTIONS, REGION_OPTIONS, VALID_SITUATION } from '../options'
import { SITUATION_TO_CONDITIONS } from '@/lib/conditions/codemap'
import { AGE_BANDS } from '@/lib/benefits/age-bands'
import { REGIONS } from '../../../../data/regions'

describe('diagnosis options', () => {
  it('상황 칩과 codemap 키가 양방향으로 정확히 일치한다', () => {
    const chips = SITUATION_OPTIONS.map((o) => o.value).sort()
    const codes = Object.keys(SITUATION_TO_CONDITIONS).sort()
    expect(chips).toEqual(codes)
    expect(VALID_SITUATION.size).toBe(SITUATION_OPTIONS.length)
  })

  it('나이 칩은 검색이 받는 밴드와 일치한다', () => {
    expect(AGE_OPTIONS.map((o) => o.value)).toEqual([...AGE_BANDS])
  })

  it('지역 칩은 17개 시도를 모두 덮는다', () => {
    expect(REGION_OPTIONS.map((o) => o.value)).toEqual(REGIONS.map((r) => r.slug))
    expect(REGION_OPTIONS).toHaveLength(17)
  })

  it('모든 칩 라벨은 비어 있지 않다', () => {
    for (const o of [...AGE_OPTIONS, ...SITUATION_OPTIONS, ...REGION_OPTIONS]) expect(o.label.trim()).not.toBe('')
  })
})
