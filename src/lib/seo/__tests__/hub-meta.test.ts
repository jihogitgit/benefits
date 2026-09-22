import { describe, it, expect, vi, afterEach } from 'vitest'
import { hubTitle, hubDescription, regionHubTitle, regionHubDescription, kstYear } from '../hub-meta'

describe('hub meta', () => {
  it('세그먼트 허브 title/description', () => {
    expect(hubTitle('청년', 2026)).toBe('2026 청년 지원금 총정리 · 조건별 조회')
    expect(hubDescription('청년', 956)).toBe('청년 지원금 956개를 나이·지역 조건으로 걸러 확인하세요. 마감 임박 순 정렬, 신청 방법과 자격을 쉬운 말로 정리했습니다.')
  })
  it('세그먼트×지역 title', () => {
    expect(regionHubTitle('서울', '청년', 2026)).toBe('2026 서울 청년 지원금 · 조건별 조회')
  })
})

describe('regionHubDescription', () => {
  const base = { regionName: '전남', segmentName: '청년', localCount: 87, nationalCount: 185 }

  it('그 지역에만 있는 건수를 앞세운다', () => {
    expect(regionHubDescription(base)).toBe(
      '전남 지자체가 직접 운영하는 청년 지원금 87개. 전국 공통 185개까지 마감 임박 순으로 함께 정리했습니다.',
    )
  })

  // 46장이 지역명과 숫자 하나만 다른 같은 문장이었던 것이 고치려던 문제다. 구별되는 정보가
  // 잘리는 자리 뒤에 있으면 고친 것이 아니다 — 한글 스니펫은 대략 80자에서 잘린다.
  it('구별되는 정보가 앞 30자 안에 있다', () => {
    const head = regionHubDescription(base).slice(0, 30)
    expect(head).toContain('전남')
    expect(head).toContain('청년')
    expect(head).toContain('87개')
  })

  // 전국 공통을 더한 값을 쓰면 청년 185·출산육아 448·소상공인 476건이 모든 지역에 똑같이
  // 깔려 숫자가 서로 비슷해진다. 지역 전용만 세는지 확인한다.
  it('전국 공통을 건수에 더하지 않는다', () => {
    expect(regionHubDescription(base)).not.toContain(`${87 + 185}개`)
  })

  it('지역이 다르면 앞자리가 달라진다', () => {
    const a = regionHubDescription(base)
    const b = regionHubDescription({ ...base, regionName: '강원', localCount: 41 })
    expect(a.slice(0, 30)).not.toBe(b.slice(0, 30))
  })

  // 지역 전용이 0인 곳은 색인이 막히지만(regionHubIndexable) 페이지 자체는 존재한다.
  it('지역 전용이 없으면 있는 것을 알린다', () => {
    expect(regionHubDescription({ ...base, localCount: 0 })).toBe(
      '전남 지자체가 따로 운영하는 청년 지원금은 아직 없습니다. 전국 어디서나 받을 수 있는 185개를 마감 임박 순으로 정리했습니다.',
    )
  })

  it('천 단위에 쉼표를 넣는다', () => {
    expect(regionHubDescription({ ...base, localCount: 1234, nationalCount: 5678 })).toContain('1,234개')
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
