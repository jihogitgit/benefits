import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

import RegionNav from '../RegionNav'

describe('RegionNav', () => {
  it('칩은 지역 페이지 링크이고, 현재 지역과 건수를 표시한다', () => {
    render(<RegionNav current="seoul" counts={{ seoul: 7 }} />)
    const nav = screen.getByRole('navigation', { name: '지역' })
    const seoul = within(nav).getByRole('link', { name: /서울/ })
    expect(seoul.getAttribute('href')).toBe('/housing/seoul')
    expect(seoul.getAttribute('aria-current')).toBe('page')
    expect(seoul.textContent).toContain('7')
    expect(within(nav).getByRole('link', { name: '전체 지역' }).getAttribute('href')).toBe('/housing')
  })
  it('드롭다운에서 지역을 고르면 그 지역으로, 전체를 고르면 /housing으로 간다', () => {
    render(<RegionNav current={null} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('')
    fireEvent.change(select, { target: { value: 'busan' } })
    expect(push).toHaveBeenLastCalledWith('/housing/busan')
    fireEvent.change(select, { target: { value: '' } })
    expect(push).toHaveBeenLastCalledWith('/housing')
  })
})
