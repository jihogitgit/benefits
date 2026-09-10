import { describe, it, expect } from 'vitest'
import { isChanged, shouldAbortForDrop } from '../diff'

describe('isChanged', () => {
  it('기존 없음 → 변경', () => expect(isChanged(undefined, '2026-01-01T00:00:00Z')).toBe(true))
  it('수정일시 같음 → 변경 아님', () => expect(isChanged('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')).toBe(false))
  it('수정일시 다름 → 변경', () => expect(isChanged('2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z')).toBe(true))
  it('둘 다 null → 변경 아님(재처리 안 함)', () => expect(isChanged(null, null)).toBe(false))
  it('Postgres 표기(+00:00)와 JS 표기(.000Z)가 같은 시각이면 변경 아님', () =>
    expect(isChanged('2026-01-29T11:18:25+00:00', '2026-01-29T11:18:25.000Z')).toBe(false))
  it('한쪽만 null이면 변경', () => expect(isChanged(null, '2026-01-29T11:18:25.000Z')).toBe(true))
})

describe('shouldAbortForDrop', () => {
  it('직전 성공 대비 30% 이상 감소면 중단', () => {
    expect(shouldAbortForDrop(10000, 6900)).toBe(true)
    expect(shouldAbortForDrop(10000, 7000)).toBe(false)
  })
  it('직전 기록 없으면 통과', () => expect(shouldAbortForDrop(null, 5)).toBe(false))
  it('0건이면 항상 중단', () => expect(shouldAbortForDrop(null, 0)).toBe(true))
})
