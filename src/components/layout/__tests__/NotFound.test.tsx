import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NotFound from '../NotFound'

describe('NotFound', () => {
  // Next 기본 404는 영문 한 줄이다. 한국어 안내와 다음 행동(찾기·분야)이 있어야 한다.
  it('한국어 안내와 다시 찾는 경로를 낸다', () => {
    render(<NotFound />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('페이지를 찾을 수 없습니다')
    expect(screen.getByRole('link', { name: '지원금 찾기' })).toHaveAttribute('href', '/benefits')
    expect(screen.getByRole('link', { name: '청년 지원금' })).toHaveAttribute('href', '/youth')
    expect(screen.queryByText(/could not be found/i)).toBeNull()
  })
})
