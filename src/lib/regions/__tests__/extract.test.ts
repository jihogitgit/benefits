import { describe, it, expect } from 'vitest'
import { extractRegion } from '../extract'

describe('extractRegion', () => {
  it('시도명을 slug로', () => {
    expect(extractRegion('서울특별시 강남구')).toBe('seoul')
    expect(extractRegion('경기도 성남시')).toBe('gyeonggi')
    expect(extractRegion('강원특별자치도')).toBe('gangwon')
    expect(extractRegion('전북특별자치도 전주시')).toBe('jeonbuk')
  })
  it('경기도 광주시는 경기', () => {
    expect(extractRegion('경기도 광주시')).toBe('gyeonggi')
  })
  it('광주광역시는 광주', () => {
    expect(extractRegion('광주광역시 북구')).toBe('gwangju')
  })
  it('중앙부처·공공기관은 ALL', () => {
    expect(extractRegion('보건복지부')).toBe('ALL')
    expect(extractRegion('국민건강보험공단')).toBe('ALL')
    expect(extractRegion('한국주택금융공사')).toBe('ALL')
    expect(extractRegion(null)).toBe('ALL')
  })
  it('교육청은 해당 시도', () => {
    expect(extractRegion('부산광역시교육청')).toBe('busan')
  })
})
