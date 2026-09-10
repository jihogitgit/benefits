import { describe, it, expect } from 'vitest'
import { computeStatus, daysUntil, kstDateString } from '../status'

const today = new Date('2026-09-10T03:00:00Z') // KST 12:00

describe('kstDateString', () => {
  it('UTC 자정 직전은 KST 다음날', () => {
    expect(kstDateString(new Date('2026-09-10T16:00:00Z'))).toBe('2026-09-11')
  })
})

describe('computeStatus', () => {
  it('상시는 open', () => {
    expect(computeStatus({ deadline_type: 'always', apply_end: null }, today)).toBe('open')
  })
  it('종료일이 오늘이면 open, 지났으면 closed', () => {
    expect(computeStatus({ deadline_type: 'period', apply_end: '2026-09-10' }, today)).toBe('open')
    expect(computeStatus({ deadline_type: 'period', apply_end: '2026-09-09' }, today)).toBe('closed')
  })
  it('unknown은 open', () => {
    expect(computeStatus({ deadline_type: 'unknown', apply_end: null }, today)).toBe('open')
  })
})

describe('daysUntil', () => {
  it('KST 기준 남은 일수', () => {
    expect(daysUntil('2026-09-22', today)).toBe(12)
    expect(daysUntil('2026-09-10', today)).toBe(0)
    expect(daysUntil('2026-09-08', today)).toBe(-2)
    expect(daysUntil(null, today)).toBeNull()
  })
})
