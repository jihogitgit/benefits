import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import HousingCard from '../HousingCard'
import type { HousingCardRow } from '@/lib/housing/queries'

const now = new Date('2026-01-20T03:00:00Z') // KST 1/20

const base: HousingCardRow = {
  slug: '래미안-테스트', title: '래미안 테스트', source: 'applyhome', kind: 'apt', kind_detail: '민영', region_code: 'seoul', status: 'open',
  receipt_start: '2026-01-19', receipt_end: '2026-01-25', total_units: 320, sp_newlywed_units: 20, sp_first_life_units: 0, sp_multi_child_units: 3, detail_url: 'https://example.com',
}

beforeEach(() => vi.useFakeTimers({ now, toFake: ['Date'] }))
afterEach(() => vi.useRealTimers())

describe('HousingCard', () => {
  it('청약홈 접수중 공고는 D-day·지역·종류·세대수와 특별공급 배지를 내고 상세로 링크한다', () => {
    render(<HousingCard row={base} now={now} />)
    expect(screen.getByText('D-5')).toBeInTheDocument()
    expect(screen.getByText('서울')).toBeInTheDocument()
    expect(screen.getByText('아파트 분양')).toBeInTheDocument()
    expect(screen.getByText(/320세대/)).toBeInTheDocument()
    expect(screen.getByText('신혼부부 특공')).toBeInTheDocument()
    expect(screen.getByText('다자녀 특공')).toBeInTheDocument()
    expect(screen.queryByText('생애최초 특공')).toBeNull() // 0세대면 배지 없음
    expect(screen.getByRole('link', { name: '래미안 테스트' })).toHaveAttribute('href', '/housing/래미안-테스트')
  })

  it('접수 예정은 시작까지 남은 날을 낸다', () => {
    render(<HousingCard row={{ ...base, status: 'upcoming', receipt_start: '2026-01-23' }} now={now} />)
    expect(screen.getByText('D-3 접수 시작')).toBeInTheDocument()
  })

  // LH는 API가 일정을 주지 않지만 상세에 유형별 공통 자격과 원문 링크가 있어 상세로 보낸다.
  it('LH 공고는 상태 라벨을 내고 상세로 링크한다(원문으로 바로 나가지 않는다)', () => {
    render(<HousingCard row={{ ...base, source: 'lh', kind: 'lh_rent', kind_detail: '행복주택', receipt_start: null, receipt_end: null, total_units: null, sp_newlywed_units: 0, sp_multi_child_units: 0, detail_url: 'https://apply.lh.or.kr/x' }} now={now} />)
    expect(screen.getByText('접수중')).toBeInTheDocument()
    expect(screen.getByText('행복주택')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /래미안 테스트/ })
    expect(link).toHaveAttribute('href', '/housing/래미안-테스트')
    expect(link).not.toHaveAttribute('target')
  })

  it('유형의 공통 자격 한 줄을 붙인다', () => {
    render(<HousingCard row={{ ...base, source: 'lh', kind: 'lh_rent', kind_detail: '국민임대', title: '어느 단지 국민임대 예비입주자 모집' }} now={now} />)
    expect(screen.getByText(/무주택세대구성원이고 소득이 도시근로자 월평균소득의 70% 이하/)).toBeInTheDocument()
    expect(screen.queryByText(/자격 완화 공고/)).toBeNull()
  })

  it('제목이 자격 완화를 알리면 한 줄 앞에 표시한다', () => {
    render(<HousingCard row={{ ...base, source: 'lh', kind: 'lh_rent', kind_detail: '국민임대', title: '어느 단지 국민임대 입주자격 완화 상시모집' }} now={now} />)
    expect(screen.getByText(/자격 완화 공고/)).toBeInTheDocument()
  })

  it('안내가 없는 유형은 자격 한 줄을 붙이지 않는다', () => {
    const { container } = render(<HousingCard row={{ ...base, source: 'lh', kind: 'lh_rent', kind_detail: '가정어린이집' }} now={now} />)
    expect(container.querySelectorAll('p')).toHaveLength(1) // 세부 구분 줄만
  })

  it('마감은 회색 라벨', () => {
    render(<HousingCard row={{ ...base, status: 'closed', receipt_end: '2026-01-10' }} now={now} />)
    expect(screen.getByText('마감')).toBeInTheDocument()
    expect(screen.queryByText(/D-/)).toBeNull()
  })

  it('지역 미상은 "지역 미상"으로', () => {
    render(<HousingCard row={{ ...base, region_code: 'UNKNOWN' }} now={now} />)
    expect(screen.getByText('지역 미상')).toBeInTheDocument()
  })

  it('원문 URL이 없는 LH 공고도 상세로 링크한다', () => {
    render(<HousingCard row={{ ...base, source: 'lh', kind: 'lh_rent', detail_url: null }} now={now} />)
    expect(screen.getByRole('link', { name: '래미안 테스트' })).toHaveAttribute('href', '/housing/래미안-테스트')
  })

  it('시작일이 오늘인 접수 예정은 "접수 예정"', () => {
    render(<HousingCard row={{ ...base, status: 'upcoming', receipt_start: '2026-01-20' }} now={now} />)
    expect(screen.getByText('접수 예정')).toBeInTheDocument()
  })

  it('접수중이지만 마감일 없으면 "접수중" 라벨', () => {
    render(<HousingCard row={{ ...base, receipt_end: null }} now={now} />)
    expect(screen.getByText('접수중')).toBeInTheDocument()
  })
})
