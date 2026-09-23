import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { BenefitListRow } from '@/lib/benefits/queries'
import BenefitCard from '../BenefitCard'

const row: BenefitListRow = {
  slug: '서울-임산부-교통비', title: '서울시 임산부 교통비 지원', summary: '임산부 교통비 70만원',
  amount_text: '○ 교통 포인트 70만원\r\n - 카드 충전', deadline_type: 'period', apply_start: null, apply_end: '2026-09-22',
  region_code: 'seoul', segments: ['parenting' as const], agency: '서울특별시', synced_at: '2026-09-10T00:00:00Z',
}
const now = new Date('2026-09-10T03:00:00Z')

describe('BenefitCard', () => {
  it('제목 링크, D-day, 지역, 본문 첫 줄을 보여준다', () => {
    render(<BenefitCard row={row} now={now} />)
    expect(screen.getByRole('link', { name: /서울시 임산부 교통비 지원/ })).toHaveAttribute('href', '/benefit/서울-임산부-교통비')
    expect(screen.getByText('D-12')).toBeInTheDocument()
    expect(screen.getByText('서울')).toBeInTheDocument()
    // 본문은 summary에서 온다. amount_text('교통 포인트 70만원')가 아니다.
    expect(screen.getByText('임산부 교통비 70만원')).toBeInTheDocument()
  })
  it('상시는 상시 배지, 전국은 전국 표기', () => {
    render(<BenefitCard row={{ ...row, deadline_type: 'always', apply_end: null, region_code: 'ALL' }} now={now} />)
    expect(screen.getByText('상시')).toBeInTheDocument()
    expect(screen.getByText('전국')).toBeInTheDocument()
  })
})

/** 보조금24 원문이 실제로 어떻게 생겼는지를 고정한다. 표본은 검색 API에서 그대로 떠 왔다. */
describe('BenefitCard 본문 출처', () => {
  const real = (over: Partial<BenefitListRow> = {}): BenefitListRow => ({
    ...row,
    title: '2026년 경기도 장애인 평생교육이용권 지원(추가모집)',
    summary: '장애인 평생교육이용권 포인트 지원(1인 35만원)',
    amount_text: '< 2026년 경기도 장애인 평생교육이용권 지원(추가모집) 개요 >\r\n\r\n○ 신청기간 : 2026. 9. 14.',
    ...over,
  })

  it('amount_text의 머리말 대신 summary를 보여준다', () => {
    render(<BenefitCard row={real()} />)
    expect(screen.getByText('장애인 평생교육이용권 포인트 지원(1인 35만원)')).toBeInTheDocument()
    // 제목을 되풀이하는 '< … 개요 >' 줄이 본문으로 새어 나오지 않는다
    expect(screen.queryByText(/개요 >/)).not.toBeInTheDocument()
  })

  it('summary가 비면 amount_text로 물러난다', () => {
    render(<BenefitCard row={real({ summary: null })} />)
    expect(screen.getByText(/개요 >/)).toBeInTheDocument()
  })

  it('summary의 줄바꿈 뒤 각주는 버린다', () => {
    // 실제 데이터에 '지원*\r\n   * 3개월 이상 실근' 같은 행이 있다
    render(<BenefitCard row={real({ summary: '대체인력 근로자에게 근속 인센티브 지원*\r\n                * 3개월 이상 실근' })} />)
    expect(screen.getByText('대체인력 근로자에게 근속 인센티브 지원*')).toBeInTheDocument()
  })

  it('둘 다 비면 본문 없이 제목만 남는다', () => {
    render(<BenefitCard row={real({ summary: null, amount_text: null })} />)
    expect(screen.getByRole('link', { name: /평생교육이용권 지원/ })).toBeInTheDocument()
    expect(screen.queryByText(/개요/)).not.toBeInTheDocument()
  })
})
