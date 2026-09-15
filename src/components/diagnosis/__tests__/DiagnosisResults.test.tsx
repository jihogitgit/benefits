import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import DiagnosisResults from '../DiagnosisResults'

const item = (slug: string, extra = {}) => ({
  slug, title: `제목 ${slug}`, summary: null, amount_text: '10만원', deadline_type: 'always', apply_end: null,
  region_code: 'ALL', segments: ['youth'], agency: null, hasConditions: true, dday: null, score: 0, ...extra,
})

describe('DiagnosisResults', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    localStorage.clear()
    // fetchMock은 describe 스코프에서 공유된다. 초기화하지 않으면 앞 테스트의 호출이
    // mock.calls 인덱스를 밀어 뒤 테스트의 단언이 엉뚱한 호출을 본다.
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('진단이 없으면 홈으로 안내', () => {
    render(<DiagnosisResults />)
    expect(screen.getByRole('link', { name: /조건 고르러 가기/ })).toHaveAttribute('href', '/')
  })

  it('저장된 진단으로 검색해 목록과 총 개수를 보여주고, 조건 확인 필요 그룹을 구분한다', async () => {
    localStorage.setItem('diagnosis', JSON.stringify({ ageBand: '20s', situations: ['job_seeker'], region: 'seoul' }))
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ total: 2, items: [item('a'), item('b', { hasConditions: false })] })))
    render(<DiagnosisResults />)
    await waitFor(() => expect(screen.getByText(/총 2개/)).toBeInTheDocument())
    expect(screen.getByText('제목 a')).toBeInTheDocument()
    expect(screen.getByText(/조건 확인 필요/)).toBeInTheDocument()
    const url = new URL(fetchMock.mock.calls[0][0] as string, 'http://localhost')
    expect(url.searchParams.get('age')).toBe('20s')
    expect(url.searchParams.get('limit')).toBe('50')
  })

  it('더 보기를 누르면 offset을 늘려 추가 조회', async () => {
    localStorage.setItem('diagnosis', JSON.stringify({ ageBand: '20s', situations: [], region: null }))
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ total: 60, items: Array.from({ length: 50 }, (_, i) => item(`a${i}`)) })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ total: 60, items: Array.from({ length: 10 }, (_, i) => item(`b${i}`)) })))
    render(<DiagnosisResults />)
    await waitFor(() => expect(screen.getByRole('button', { name: /더 보기/ })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /더 보기/ }))
    await waitFor(() => expect(screen.getByText('제목 b9')).toBeInTheDocument())
    expect(new URL(fetchMock.mock.calls[1][0] as string, 'http://localhost').searchParams.get('offset')).toBe('50')
    expect(screen.queryByRole('button', { name: /더 보기/ })).toBeNull()
  })
})
