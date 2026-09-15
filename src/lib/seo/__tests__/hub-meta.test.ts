import { describe, it, expect, vi, afterEach } from 'vitest'
import { hubTitle, hubDescription, regionHubTitle, regionHubDescription, kstYear } from '../hub-meta'

describe('hub meta', () => {
  it('세그먼트 허브 title/description', () => {
    expect(hubTitle('청년', 2026)).toBe('2026 청년 지원금 총정리 · 조건별 조회')
    expect(hubDescription('청년', 956)).toBe('청년 지원금 956개를 나이·지역 조건으로 걸러 확인하세요. 마감 임박 순 정렬, 신청 방법과 자격을 쉬운 말로 정리했습니다.')
  })
  it('세그먼트×지역', () => {
    expect(regionHubTitle('서울', '청년', 2026)).toBe('2026 서울 청년 지원금 · 조건별 조회')
    expect(regionHubDescription('서울', '청년', 41)).toBe('서울에서 받을 수 있는 청년 지원금 41개(전국 공통 포함). 마감 임박 순으로 정리했습니다.')
  })
})

describe('kstYear', () => {
  afterEach(() => {
    vi.useRealTimers()
  })
  it('UTC 자정 이전이어도 KST 기준 해를 쓴다', () => {
    vi.useFakeTimers()
    // 2025-12-31T20:00Z = 2026-01-01 05:00 KST
    vi.setSystemTime(new Date('2025-12-31T20:00:00Z'))
    expect(kstYear()).toBe(2026)
    expect(kstYear(new Date('2026-01-01T00:00:00Z'))).toBe(2026)
    expect(kstYear(new Date('2025-12-31T10:00:00Z'))).toBe(2025)
  })
})
