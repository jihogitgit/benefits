import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import EditorialByline from '../EditorialByline'

afterEach(() => {
  delete process.env.NEXT_PUBLIC_EDITOR_NAME
  delete process.env.SITE_NAME
})

describe('EditorialByline', () => {
  it('이름이 없으면 사이트명 편집팀을 검수자로 적고 편집 원칙으로 링크한다', () => {
    render(<EditorialByline reviewedAt="2026-09-20T03:00:00Z" />)
    expect(screen.getByText(/검수 내몫 편집팀/)).toBeInTheDocument()
    expect(screen.getByText(/검수 2026\.09\.20/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '편집 원칙' })).toHaveAttribute('href', '/about#editorial')
  })

  it('NEXT_PUBLIC_EDITOR_NAME이 있으면 그 이름을 쓴다', () => {
    process.env.NEXT_PUBLIC_EDITOR_NAME = '홍길동'
    render(<EditorialByline publishedAt="2026-09-01T00:00:00Z" />)
    expect(screen.getByText(/검수 홍길동/)).toBeInTheDocument()
    expect(screen.getByText(/발행 2026\.09\.01/)).toBeInTheDocument()
  })

  // 발행일로 채우면 "증보한 적 없음"과 "발행 당일 증보"가 구분되지 않는다(queries.ts GuideRow.updated_at 주석).
  it('수정일이 없으면 수정 표기를 내지 않는다', () => {
    render(<EditorialByline publishedAt="2026-09-01T00:00:00Z" updatedAt={null} />)
    expect(screen.queryByText(/수정/)).toBeNull()
  })

  it('수정일이 있으면 발행·수정을 함께 낸다', () => {
    render(<EditorialByline publishedAt="2026-09-01T00:00:00Z" updatedAt="2026-10-15T00:00:00Z" />)
    expect(screen.getByText(/발행 2026\.09\.01/)).toBeInTheDocument()
    expect(screen.getByText(/수정 2026\.10\.15/)).toBeInTheDocument()
  })
})
