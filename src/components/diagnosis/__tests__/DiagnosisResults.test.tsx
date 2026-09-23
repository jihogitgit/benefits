import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import DiagnosisResults from '../DiagnosisResults'

// useSearchParams를 테스트마다 바꿔 끼운다.
let searchParams = new URLSearchParams('')
vi.mock('next/navigation', () => ({ useSearchParams: () => searchParams }))

const item = (slug: string, extra = {}) => ({
  slug, title: `제목 ${slug}`, summary: null, amount_text: '10만원', deadline_type: 'always', apply_end: null,
  region_code: 'ALL', segments: ['youth'], agency: null, hasConditions: true, dday: null, score: 0, ...extra,
})

describe('DiagnosisResults', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    localStorage.clear()
    searchParams = new URLSearchParams('')
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

  it('검색어를 지워도 검색창이 남는다 (막다른 길 방지)', async () => {
    // 검색어만 넣은 상태에서 그것을 지우면 isEmpty가 된다. 검색창이 빈 진단 분기 안에 있으면
    // 그 순간 입력칸까지 사라져 다시 칠 수단이 없어지고 홈으로 돌아가야만 한다.
    localStorage.setItem('diagnosis', JSON.stringify({ q: '월세', ageBand: null, situations: [], region: null }))
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ total: 1, items: [item('a')] })))
    render(<DiagnosisResults />)
    await waitFor(() => expect(screen.getByText(/총 1개/)).toBeInTheDocument())
    expect(screen.getByLabelText('지원금 이름으로 찾기')).toHaveValue('월세')

    fireEvent.click(screen.getByRole('button', { name: '검색어 지우기' }))

    await waitFor(() => expect(screen.getByText(/아직 고른 조건이 없습니다/)).toBeInTheDocument())
    expect(screen.getByLabelText('지원금 이름으로 찾기')).toBeInTheDocument()
    expect(screen.getByLabelText('지원금 이름으로 찾기')).toHaveValue('')
  })

  it('결과 화면에서 검색어를 바꾸면 기존 필터를 유지한 채 다시 조회한다', async () => {
    localStorage.setItem('diagnosis', JSON.stringify({ q: '', ageBand: '20s', situations: [], region: 'seoul' }))
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ total: 1, items: [item('a')] })))
    render(<DiagnosisResults />)
    await waitFor(() => expect(screen.getByText(/총 1개/)).toBeInTheDocument())

    const input = screen.getByLabelText('지원금 이름으로 찾기')
    fireEvent.change(input, { target: { value: '월세' } })
    fireEvent.blur(input)

    await waitFor(() => {
      const sp = new URL(fetchMock.mock.calls.at(-1)![0] as string, 'http://localhost').searchParams
      expect(sp.get('q')).toBe('월세')
      expect(sp.get('age')).toBe('20s')
      expect(sp.get('region')).toBe('seoul')
    })
    expect(JSON.parse(localStorage.getItem('diagnosis')!).q).toBe('월세')
  })

describe('URL 파라미터로 들어온 경우', () => {
  it('URL 조건이 저장된 조건을 이긴다', async () => {
    // 가이드 글이 거는 링크로 들어왔는데 옛 조건을 보여주면 링크가 약속한 것과 다른 화면이 뜬다.
    localStorage.setItem('diagnosis', JSON.stringify({ q: '', ageBand: '50s+', situations: [], region: 'busan' }))
    searchParams = new URLSearchParams('age=20s&situations=no_house')
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ total: 1, items: [item('a')] })))
    render(<DiagnosisResults />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const sp = new URL(fetchMock.mock.calls.at(-1)![0] as string, 'http://localhost').searchParams
    expect(sp.get('age')).toBe('20s')
    expect(sp.get('situations')).toBe('no_house')
    expect(sp.get('region')).toBeNull()
  })

  it('URL 조건을 저장까지 한다 (조건 바꾸기로 홈에 가면 이어진다)', async () => {
    searchParams = new URLSearchParams('age=20s&situations=no_house')
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ total: 1, items: [item('a')] })))
    render(<DiagnosisResults />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(JSON.parse(localStorage.getItem('diagnosis')!)).toEqual({
      q: '', ageBand: '20s', situations: ['no_house'], region: null, incomeBand: null,
    })
  })

  it('URL이 비어 있으면 저장된 조건을 쓴다', async () => {
    localStorage.setItem('diagnosis', JSON.stringify({ q: '', ageBand: '30s', situations: [], region: 'seoul' }))
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ total: 1, items: [item('a')] })))
    render(<DiagnosisResults />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const sp = new URL(fetchMock.mock.calls.at(-1)![0] as string, 'http://localhost').searchParams
    expect(sp.get('age')).toBe('30s')
    expect(sp.get('region')).toBe('seoul')
  })

  it('허용되지 않은 URL 값은 무시하고 저장분으로 떨어지지 않는다', async () => {
    searchParams = new URLSearchParams('age=99s&region=mars')
    render(<DiagnosisResults />)
    await waitFor(() => expect(screen.getByText(/아직 고른 조건이 없습니다/)).toBeInTheDocument())
  })
})
})
