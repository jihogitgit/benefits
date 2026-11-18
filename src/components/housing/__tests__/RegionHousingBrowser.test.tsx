import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { HousingCardRow } from '@/lib/housing/queries'
import RegionHousingBrowser from '../RegionHousingBrowser'

const base: HousingCardRow = {
  slug: 'x', title: 'x', source: 'applyhome', kind: 'apt', kind_detail: null, region_code: 'seoul', status: 'open',
  receipt_start: null, receipt_end: null, total_units: null, sp_newlywed_units: 0, sp_first_life_units: 0, sp_multi_child_units: 0, detail_url: null,
}
const local: HousingCardRow[] = [
  { ...base, slug: 'apt-open', title: '아파트 접수중' },
  { ...base, slug: 'apt-upcoming', title: '아파트 예정', status: 'upcoming' },
  { ...base, slug: 'rent-open', title: '임대 접수중', source: 'lh', kind: 'lh_rent' },
]
const national: HousingCardRow[] = [{ ...base, slug: 'nat', title: '전국 임대 예정', source: 'lh', kind: 'lh_rent', region_code: 'ALL', status: 'upcoming' }]
const titles = () => screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent)

describe('RegionHousingBrowser', () => {
  it('처음에는 전부 보이고, 종류 칩은 이 지역에 있는 것만 나온다', () => {
    render(<RegionHousingBrowser name="서울" local={local} national={national} />)
    expect(titles()).toEqual(['아파트 접수중', '아파트 예정', '임대 접수중', '전국 임대 예정'])
    expect(screen.getByRole('button', { name: 'LH 임대' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'LH 분양' })).toBeNull()
  })
  it('접수 상태로 거른다(지역·전국 모두)', () => {
    render(<RegionHousingBrowser name="서울" local={local} national={national} />)
    fireEvent.click(screen.getByRole('button', { name: /^접수중/ }))
    expect(titles()).toEqual(['아파트 접수중', '임대 접수중'])
    expect(screen.getByRole('button', { name: /^접수중/ }).getAttribute('aria-pressed')).toBe('true')
  })
  it('상태와 종류를 함께 건다, 결과가 없으면 안내한다', () => {
    render(<RegionHousingBrowser name="서울" local={local} national={national} />)
    fireEvent.click(screen.getByRole('button', { name: /^접수 예정/ }))
    fireEvent.click(screen.getByRole('button', { name: 'LH 임대' }))
    expect(titles()).toEqual(['전국 임대 예정'])
    expect(screen.getByText('조건에 맞는 공고가 없습니다. 필터를 바꿔 보세요.')).toBeTruthy()
  })
  it('공고가 하나도 없으면 필터를 내지 않는다', () => {
    render(<RegionHousingBrowser name="세종" local={[]} national={[]} />)
    expect(screen.queryByTestId('region-filters')).toBeNull()
    expect(screen.getByText('지금 접수 중인 세종 공고가 없습니다.')).toBeTruthy()
  })
})
