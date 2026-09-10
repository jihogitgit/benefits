import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DiagnosisPanel from '../DiagnosisPanel'

describe('DiagnosisPanel', () => {
  const fetchMock = vi.fn()
  const okResponse = () => Promise.resolve(new Response(JSON.stringify({ total: 27, items: [] })))
  beforeEach(() => {
    localStorage.clear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    // Response 본문은 한 번만 읽을 수 있다. mockResolvedValue로 같은 객체를 돌려주면 두 번째
    // 호출의 r.json()이 실패해 실제 조회 실패와 구분되지 않는다. 호출마다 새 Response를 만든다.
    fetchMock.mockImplementation(okResponse)
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

  it('개수 조회가 실패하면 로딩 문구 대신 중립 문구를 보여준다', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response('nope', { status: 500 })))
    render(<DiagnosisPanel />)
    fireEvent.click(screen.getByRole('button', { name: '30대' }))
    await waitFor(() => expect(screen.getByRole('link', { name: /내 지원금 보기/ })).toBeInTheDocument())
    expect(screen.queryByText(/찾는 중/)).not.toBeInTheDocument()
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
