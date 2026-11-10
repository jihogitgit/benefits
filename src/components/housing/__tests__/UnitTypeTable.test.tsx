import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import UnitTypeTable from '../UnitTypeTable'
import type { HousingUnitTypeRow } from '@/types/housing'

const row = (o: Partial<HousingUnitTypeRow>): HousingUnitTypeRow => ({
  notice_id: 'n1', house_type: '084A', supply_area: 84.9, max_price_manwon: 98000, general_units: 100, special_units: 0,
  sp_newlywed: null, sp_first_life: null, sp_multi_child: null, sp_old_parents: null, sp_institution: null, sp_etc: null, ...o,
})

describe('UnitTypeTable', () => {
  it('분양가를 억 단위로 환산한다', () => {
    render(<UnitTypeTable rows={[row({}), row({ house_type: '120B', max_price_manwon: 120000 }), row({ house_type: '059C', max_price_manwon: null })]} />)
    expect(screen.getByText('9.8억')).toBeInTheDocument()
    expect(screen.getByText('12억')).toBeInTheDocument()
    const cells = screen.getAllByRole('row').find((r) => r.textContent?.startsWith('059C'))!
    expect(cells.textContent).toContain('-')
  })

  it('특별공급 세대가 모두 0/null이면 특별 열을 숨긴다', () => {
    render(<UnitTypeTable rows={[row({}), row({ house_type: '059', special_units: null })]} />)
    expect(screen.queryByText('특별')).toBeNull()
    expect(screen.queryByText('신혼')).toBeNull()
    render(<UnitTypeTable rows={[row({ special_units: 10 })]} />)
    expect(screen.getByText('특별')).toBeInTheDocument()
  })

  it('경계값과 면적 표시', () => {
    render(<UnitTypeTable rows={[row({ house_type: 'A', max_price_manwon: 99999, supply_area: 84.9712 }), row({ house_type: 'B', max_price_manwon: 5000 })]} />)
    expect(screen.getByText('10억')).toBeInTheDocument()
    expect(screen.getByText('5,000만원')).toBeInTheDocument()
    expect(screen.getByText('84.97')).toBeInTheDocument()
  })
})
