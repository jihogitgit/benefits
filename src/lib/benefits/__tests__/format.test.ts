import { describe, it, expect } from 'vitest'
import { ddayLabel, deadlineLabel, firstLine, formatKstDate } from '../format'

describe('ddayLabel', () => {
  it('D-n, 오늘 마감, 마감됨, null', () => {
    expect(ddayLabel(12)).toBe('D-12')
    expect(ddayLabel(0)).toBe('오늘 마감')
    expect(ddayLabel(-3)).toBe('마감됨')
    expect(ddayLabel(null)).toBeNull()
  })
})

describe('deadlineLabel', () => {
  it('유형별 문구', () => {
    expect(deadlineLabel({ deadline_type: 'always', apply_start: null, apply_end: null })).toBe('상시 신청')
    expect(deadlineLabel({ deadline_type: 'period', apply_start: '2026-03-01', apply_end: '2026-03-31' })).toBe('2026.03.01 ~ 2026.03.31')
    expect(deadlineLabel({ deadline_type: 'period', apply_start: null, apply_end: '2026-03-31' })).toBe('2026.03.31까지')
    expect(deadlineLabel({ deadline_type: 'unknown', apply_start: null, apply_end: null })).toBe('공고 확인')
  })
})

describe('firstLine', () => {
  it('연도로 시작하는 줄은 연도를 보존한다 (번호 목록으로 오인 금지)', () => {
    expect(firstLine('2026.03.01. ~ 2026.03.31. 접수')).toBe('2026.03.01. ~ 2026.03.31. 접수')
    expect(firstLine('※ 2026. 3. 1~2027.2.28. 까지 적용')).toBe('2026. 3. 1~2027.2.28. 까지 적용')
  })

  it('번호 목록 접두사는 제거한다', () => {
    expect(firstLine('1) 지원 대상')).toBe('지원 대상')
    expect(firstLine('3. 신청 방법')).toBe('신청 방법')
  })

  it('원문의 첫 의미 있는 줄을 120자 이내로', () => {
    expect(firstLine('○ 3~5세에 대해 교육비를 지급합니다.\r\n  - 국공립 100,000원')).toBe('3~5세에 대해 교육비를 지급합니다.')
    expect(firstLine(null)).toBeNull()
    expect(firstLine('가'.repeat(200))!.length).toBe(120)
  })
})

describe('formatKstDate', () => {
  it('ISO → YYYY.MM.DD HH:mm (KST)', () => {
    expect(formatKstDate('2026-09-10T03:05:00.000Z')).toBe('2026.09.10 12:05')
  })
})
