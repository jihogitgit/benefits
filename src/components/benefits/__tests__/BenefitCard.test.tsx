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
  it('제목 링크, D-day, 지역, 금액 첫 줄을 보여준다', () => {
    render(<BenefitCard row={row} now={now} />)
    expect(screen.getByRole('link', { name: /서울시 임산부 교통비 지원/ })).toHaveAttribute('href', '/benefit/서울-임산부-교통비')
    expect(screen.getByText('D-12')).toBeInTheDocument()
    expect(screen.getByText('서울')).toBeInTheDocument()
    expect(screen.getByText('교통 포인트 70만원')).toBeInTheDocument()
  })
  it('상시는 상시 배지, 전국은 전국 표기', () => {
    render(<BenefitCard row={{ ...row, deadline_type: 'always', apply_end: null, region_code: 'ALL' }} now={now} />)
    expect(screen.getByText('상시')).toBeInTheDocument()
    expect(screen.getByText('전국')).toBeInTheDocument()
  })
})
