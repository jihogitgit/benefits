import { describe, it, expect } from 'vitest'
import { parseDeadline } from '../deadline'

describe('parseDeadline', () => {
  it('상시 키워드는 always', () => {
    expect(parseDeadline('상시신청')).toEqual({ deadline_type: 'always', apply_start: null, apply_end: null })
    expect(parseDeadline('연중 상시')).toEqual({ deadline_type: 'always', apply_start: null, apply_end: null })
    expect(parseDeadline('수시').deadline_type).toBe('always')
    expect(parseDeadline('연중').deadline_type).toBe('always')
  })
  it('두 날짜는 기간', () => {
    expect(parseDeadline('2026.03.01. ~ 2026.03.31.')).toEqual({ deadline_type: 'period', apply_start: '2026-03-01', apply_end: '2026-03-31' })
    expect(parseDeadline('2026-01-05~2026-02-10')).toEqual({ deadline_type: 'period', apply_start: '2026-01-05', apply_end: '2026-02-10' })
    expect(parseDeadline('2026년 4월 1일 ~ 2026년 4월 30일')).toEqual({ deadline_type: 'period', apply_start: '2026-04-01', apply_end: '2026-04-30' })
    // 실데이터 형태 (한 자리 월·일)
    expect(parseDeadline('2026.1.1.~2026.12.10.')).toEqual({ deadline_type: 'period', apply_start: '2026-01-01', apply_end: '2026-12-10' })
  })
  it('날짜 하나는 종료일만', () => {
    expect(parseDeadline('2026.12.31.까지')).toEqual({ deadline_type: 'period', apply_start: null, apply_end: '2026-12-31' })
  })
  it('해석 불가는 unknown', () => {
    expect(parseDeadline('접수기관 별 상이')).toEqual({ deadline_type: 'unknown', apply_start: null, apply_end: null })
    expect(parseDeadline('공고에 따름').deadline_type).toBe('unknown')
    expect(parseDeadline('○ 정기신청 : 5.1.~5.31.').deadline_type).toBe('unknown') // 연도 없음
    expect(parseDeadline(null)).toEqual({ deadline_type: 'unknown', apply_start: null, apply_end: null })
  })
  it('예산 소진 시까지는 always', () => {
    expect(parseDeadline('예산 소진시까지').deadline_type).toBe('always')
  })
})
