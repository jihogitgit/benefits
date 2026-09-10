import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchPage, fetchAll } from '../gov24'

function page(op: string, page: number, perPage: number, total: number) {
  const remaining = Math.max(0, total - (page - 1) * perPage)
  const count = Math.min(perPage, remaining)
  const data = Array.from({ length: count }, (_, i) => ({
    서비스ID: `${op}-${(page - 1) * perPage + i}`,
    서비스명: `서비스 ${i}`,
  }))
  return { currentCount: count, matchCount: total, page, perPage, totalCount: total, data }
}

describe('gov24 client', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    process.env.GOV24_API_KEY = 'k'
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('fetchPage는 serviceKey·page·perPage·returnType 파라미터를 붙인다', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(page('serviceList', 1, 2, 2))))
    await fetchPage('serviceList', 1, 2)
    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.pathname).toBe('/api/gov24/v3/serviceList')
    expect(url.searchParams.get('serviceKey')).toBe('k')
    expect(url.searchParams.get('page')).toBe('1')
    expect(url.searchParams.get('perPage')).toBe('2')
    expect(url.searchParams.get('returnType')).toBe('JSON')
  })

  it('fetchAll은 totalCount까지 페이지를 순회해 합친다', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(page('serviceList', 1, 3, 7))))
      .mockResolvedValueOnce(new Response(JSON.stringify(page('serviceList', 2, 3, 7))))
      .mockResolvedValueOnce(new Response(JSON.stringify(page('serviceList', 3, 3, 7))))
    const all = await fetchAll('serviceList', { perPage: 3, delayMs: 0 })
    expect(all).toHaveLength(7)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('HTTP 오류는 상태 코드를 담아 throw한다', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 401 }))
    await expect(fetchPage('serviceList', 1, 10)).rejects.toThrow(/401/)
  })

  it('키가 없으면 throw한다', async () => {
    delete process.env.GOV24_API_KEY
    await expect(fetchPage('serviceList', 1, 10)).rejects.toThrow(/GOV24_API_KEY/)
  })
})
