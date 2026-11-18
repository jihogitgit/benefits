import { describe, expect, it } from 'vitest'
import { effectiveHousingStatus, sortActiveHousing } from '../status'

// 2026-11-18 10:00 KST
const now = new Date('2026-11-18T01:00:00Z')

describe('effectiveHousingStatus', () => {
  it('접수 마감일이 지난 접수중 공고는 마감으로 센다(동기화가 밀린 경우)', () => {
    expect(effectiveHousingStatus({ status: 'open', receipt_start: '2026-11-09', receipt_end: '2026-11-11' }, now)).toBe('closed')
  })
  it('마감일 당일은 아직 접수중이다', () => {
    expect(effectiveHousingStatus({ status: 'open', receipt_start: '2026-11-16', receipt_end: '2026-11-18' }, now)).toBe('open')
  })
  it('접수 시작일이 된 예정 공고는 접수중으로 센다', () => {
    expect(effectiveHousingStatus({ status: 'upcoming', receipt_start: '2026-11-18', receipt_end: '2026-11-20' }, now)).toBe('open')
  })
  it('시작 전이면 예정이다', () => {
    expect(effectiveHousingStatus({ status: 'open', receipt_start: '2026-11-19', receipt_end: '2026-11-20' }, now)).toBe('upcoming')
  })
  it('일자가 없는 공고(LH)는 DB 상태 그대로', () => {
    expect(effectiveHousingStatus({ status: 'upcoming', receipt_start: null, receipt_end: null }, now)).toBe('upcoming')
    expect(effectiveHousingStatus({ status: 'open', receipt_start: null, receipt_end: null }, now)).toBe('open')
  })
  it('closed·removed는 일자와 무관하게 되살리지 않는다', () => {
    expect(effectiveHousingStatus({ status: 'closed', receipt_start: '2026-11-16', receipt_end: '2026-11-30' }, now)).toBe('closed')
    expect(effectiveHousingStatus({ status: 'removed', receipt_start: '2026-11-16', receipt_end: '2026-11-30' }, now)).toBe('removed')
  })
  it('KST 자정 직후에는 KST 날짜로 센다', () => {
    // 2026-11-18 00:30 KST = 11-17 15:30 UTC
    expect(effectiveHousingStatus({ status: 'open', receipt_start: '2026-11-10', receipt_end: '2026-11-17' }, new Date('2026-11-17T15:30:00Z'))).toBe('closed')
  })
})

describe('sortActiveHousing', () => {
  const r = (slug: string, status: 'open' | 'upcoming', receipt_start: string | null, receipt_end: string | null) => ({ slug, status, receipt_start, receipt_end })
  it('접수중(마감 임박 순) → 접수 예정(시작 임박 순), 일자 없는 공고는 각 묶음 뒤', () => {
    const out = sortActiveHousing([
      r('u-late', 'upcoming', '2026-12-01', '2026-12-03'),
      r('u-lh', 'upcoming', null, null),
      r('o-late', 'open', '2026-11-10', '2026-11-30'),
      r('u-soon', 'upcoming', '2026-11-20', '2026-12-20'),
      r('o-lh', 'open', null, null),
      r('o-soon', 'open', '2026-11-17', '2026-11-19'),
    ])
    expect(out.map((x) => x.slug)).toEqual(['o-soon', 'o-late', 'o-lh', 'u-soon', 'u-late', 'u-lh'])
  })
  it('같은 날은 slug 순, 입력을 바꾸지 않는다', () => {
    const input = [r('b', 'open', null, '2026-11-20'), r('a', 'open', null, '2026-11-20')]
    expect(sortActiveHousing(input).map((x) => x.slug)).toEqual(['a', 'b'])
    expect(input.map((x) => x.slug)).toEqual(['b', 'a'])
  })
})
