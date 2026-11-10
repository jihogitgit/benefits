import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HousingSchedule from '../HousingSchedule'
import type { HousingDetail } from '@/lib/housing/queries'

const d = (o: Partial<HousingDetail>): HousingDetail => ({
  slug: 's', title: 't', source: 'applyhome', kind: 'apt', kind_detail: null, region_code: 'seoul', status: 'open',
  receipt_start: null, receipt_end: null, total_units: null, sp_newlywed_units: 0, sp_first_life_units: 0, sp_multi_child_units: 0, detail_url: null,
  address: null, supplier: null, notice_date: null, special_start: null, special_end: null, rank1_start: null, rank1_end: null,
  rank2_start: null, rank2_end: null, winner_date: null, contract_start: null, contract_end: null, move_in_ym: null,
  raw: {}, synced_at: '2026-01-20T00:00:00Z', housing_unit_types: [], ...o,
})

describe('HousingSchedule', () => {
  it('값이 있는 줄만 낸다', () => {
    const { container } = render(<HousingSchedule d={d({ notice_date: '2026-01-10', rank1_start: '2026-01-19', rank1_end: '2026-01-20' })} />)
    const dts = [...container.querySelectorAll('dt')].map((e) => e.textContent)
    expect(dts).toEqual(['모집공고일', '1순위 접수'])
    expect(screen.getByText('2026.01.19 ~ 2026.01.20')).toBeInTheDocument()
  })

  it('입주 예정은 년월로', () => {
    render(<HousingSchedule d={d({ move_in_ym: '202812' })} />)
    expect(screen.getByText('2028년 12월')).toBeInTheDocument()
  })

  it('전부 비면 아무것도 그리지 않는다', () => {
    const { container } = render(<HousingSchedule d={d({})} />)
    expect(container).toBeEmptyDOMElement()
  })
})
