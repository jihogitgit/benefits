import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DiagnosisPanel from '../DiagnosisPanel'

describe('DiagnosisPanel', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ total: 27, items: [] })))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('칩을 고르면 개수를 조회하고 localStorage에 저장한다', async () => {
    render(<DiagnosisPanel />)
    fireEvent.click(screen.getByRole('button', { name: '30대' }))
    fireEvent.click(screen.getByRole('button', { name: '임신·출산' }))
    fireEvent.click(screen.getByRole('button', { name: '서울' }))
    await waitFor(() => expect(screen.getByRole('link', { name: /내 지원금 27개 보기/ })).toBeInTheDocument())
    const url = new URL(fetchMock.mock.calls.at(-1)![0] as string, 'http://localhost')
    expect(url.pathname).toBe('/api/benefits/search')
    expect(url.searchParams.get('count')).toBe('1')
    expect(url.searchParams.get('age')).toBe('30s')
    expect(JSON.parse(localStorage.getItem('diagnosis')!)).toEqual({ ageBand: '30s', situations: ['pregnancy'], region: 'seoul' })
    expect(screen.getByRole('link', { name: /내 지원금 27개 보기/ })).toHaveAttribute('href', '/my')
  })

  it('저장된 진단이 있으면 이어서 보기 상태로 시작한다', async () => {
    localStorage.setItem('diagnosis', JSON.stringify({ ageBand: '20s', situations: ['job_seeker'], region: null }))
    render(<DiagnosisPanel />)
    expect(screen.getByRole('button', { name: '20대' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(screen.getByText(/이어서 보기/)).toBeInTheDocument())
  })

  it('아무것도 고르지 않으면 안내 문구', () => {
    render(<DiagnosisPanel />)
    expect(screen.getByText(/조건을 골라 주세요/)).toBeInTheDocument()
  })

  it('같은 칩을 다시 누르면 해제된다', () => {
    render(<DiagnosisPanel />)
    const b = screen.getByRole('button', { name: '1인 가구' })
    fireEvent.click(b)
    expect(b).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(b)
    expect(b).toHaveAttribute('aria-pressed', 'false')
  })
})
