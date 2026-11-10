import { describe, it, expect } from 'vitest'
import { KIND_LABEL, STATUS_LABEL, KIND_FILTERS, isHousingKind } from '../labels'

describe('공고 라벨', () => {
  it('모든 종류·상태에 한글 라벨이 있다', () => {
    for (const k of ['apt', 'apt_remainder', 'officetel_etc', 'lh_sale', 'lh_rent', 'lh_welfare', 'newlywed_town'] as const) expect(KIND_LABEL[k]).toBeTruthy()
    for (const s of ['upcoming', 'open', 'closed', 'removed'] as const) expect(STATUS_LABEL[s]).toBeTruthy()
  })
  it('필터 칩은 종류 전부를 한 번씩 덮는다', () => {
    expect(KIND_FILTERS.map((f) => f.kind).sort()).toEqual(Object.keys(KIND_LABEL).sort())
  })
  it('URL에서 온 값은 검사한다', () => {
    expect(isHousingKind('apt')).toBe(true)
    expect(isHousingKind('drop table')).toBe(false)
    expect(isHousingKind('constructor')).toBe(false)
    expect(isHousingKind(null)).toBe(false)
  })
})
