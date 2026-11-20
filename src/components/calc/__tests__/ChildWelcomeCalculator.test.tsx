import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ChildWelcomeCalculator from '../ChildWelcomeCalculator'

const total = () => screen.getByTestId('total').textContent

describe('ChildWelcomeCalculator', () => {
  it('기본값(2027년 7월·첫째·기본 지역·가정 보육)은 개편안 4,840만 원, 현행 대비 +1,280', () => {
    render(<ChildWelcomeCalculator />)
    expect(total()).toBe('4,840만 원')
    expect(screen.getByTestId('diff').textContent).toContain('1,280만 원')
    expect(screen.getByTestId('result').textContent).toContain('2027년 7월, 2027년 10월, 2028년 1월, 2028년 4월에 250만 원씩')
  })
  it('우대지역 셋째는 7,400만 원', () => {
    render(<ChildWelcomeCalculator />)
    fireEvent.click(screen.getByRole('button', { name: '셋째 이상' }))
    fireEvent.click(screen.getByRole('button', { name: '우대지역' }))
    expect(total()).toBe('7,400만 원')
  })
  it('2027년 6월 출생은 현행 제도 금액을 보이고, 소급이 확정되지 않았다고 알린다', () => {
    render(<ChildWelcomeCalculator />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2027-06' } })
    expect(total()).toBe('3,560만 원')
    expect(screen.getByTestId('result').textContent).toContain('현행 제도 적용')
    expect(screen.getByTestId('result').textContent).toContain('확정되지 않았습니다')
  })
  it('어린이집 이용: 개편안은 계산하고(4,120), 현행은 금액을 만들지 않는다', () => {
    render(<ChildWelcomeCalculator />)
    fireEvent.click(screen.getByRole('button', { name: '어린이집 이용' }))
    expect(total()).toBe('4,120만 원')
    expect(screen.queryByTestId('diff')).toBeNull()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2027-03' } })
    expect(screen.queryByTestId('total')).toBeNull()
    expect(screen.getByTestId('result').textContent).toContain('계산하지 않습니다')
  })
})
