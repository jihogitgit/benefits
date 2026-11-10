import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchApplyhomeDetails, fetchApplyhomeUnits } from '../applyhome'

const row = (n: number) => ({ HOUSE_MANAGE_NO: '1', PBLANC_NO: '1', MODEL_NO: String(n) })
const body = (data: unknown[], totalCount: number) => ({ currentCount: data.length, matchCount: totalCount, page: 1, perPage: 100, totalCount, data })
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
const opts = { delayMs: 0, retryBaseMs: 0 }

describe('청약홈 클라이언트', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    vi.stubEnv('HOUSING_API_KEY', 'test-key')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('totalCount가 perPage(100)를 넘으면 페이지를 이어 받아 합친다', async () => {
    fetchMock
      .mockResolvedValueOnce(json(body([row(1), row(2)], 101)))
      .mockResolvedValueOnce(json(body([row(3)], 101)))
    const r = await fetchApplyhomeUnits('apt', '1', '1', opts)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(r.map((x) => x.MODEL_NO)).toEqual(['1', '2', '3'])
  })

  it('totalCount 0이면 한 번만 요청하고 빈 배열', async () => {
    fetchMock.mockResolvedValueOnce(json(body([], 0)))
    expect(await fetchApplyhomeUnits('apt', '1', '1', opts)).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('200인데 code 본문이면 API 오류로 던진다', async () => {
    fetchMock.mockResolvedValueOnce(json({ code: -4, msg: '등록되지 않은 인증키' }))
    await expect(fetchApplyhomeUnits('apt', '1', '1', opts)).rejects.toThrow('API 오류')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('JSON이 아니면 던진다', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>oops</html>', { status: 200 }))
    await expect(fetchApplyhomeUnits('apt', '1', '1', opts)).rejects.toThrow('JSON이 아님')
  })

  it('503 뒤 200이면 재시도로 성공한다', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(json(body([row(1)], 1)))
    const r = await fetchApplyhomeUnits('apt', '1', '1', opts)
    expect(r).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('400은 재시도하지 않는다', async () => {
    fetchMock.mockResolvedValue(new Response('bad', { status: 400 }))
    await expect(fetchApplyhomeUnits('apt', '1', '1', opts)).rejects.toThrow('HTTP 400')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('page < totalPages인데 빈 페이지가 오면 멈춘다', async () => {
    fetchMock.mockResolvedValueOnce(json(body([], 1000)))
    expect(await fetchApplyhomeUnits('apt', '1', '1', opts)).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('페이지가 밀려 중복된 행은 첫 번째만 남긴다', async () => {
    fetchMock
      .mockResolvedValueOnce(json(body([row(1), row(2)], 101)))
      .mockResolvedValueOnce(json(body([row(2), row(3)], 101)))
    const r = await fetchApplyhomeUnits('apt', '1', '1', opts)
    expect(r.map((x) => x.MODEL_NO)).toEqual(['1', '2', '3'])
  })

  it('503이 계속되면 3번 시도하고 던진다', async () => {
    fetchMock.mockImplementation(async () => new Response('busy', { status: 503 }))
    await expect(fetchApplyhomeUnits('apt', '1', '1', opts)).rejects.toThrow('HTTP 503')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('429 뒤 200이면 재시도로 성공한다', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('slow down', { status: 429 }))
      .mockResolvedValueOnce(json(body([row(1)], 1)))
    expect(await fetchApplyhomeUnits('apt', '1', '1', opts)).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('네트워크 TypeError 뒤 200이면 재시도로 성공한다', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(json(body([row(1)], 1)))
    expect(await fetchApplyhomeUnits('apt', '1', '1', opts)).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('요청 시간 초과(TimeoutError) 뒤 200이면 재시도로 성공한다', async () => {
    fetchMock
      .mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'TimeoutError' }))
      .mockResolvedValueOnce(json(body([row(1)], 1)))
    expect(await fetchApplyhomeUnits('apt', '1', '1', opts)).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('PBLANC_NO가 없는 행은 스키마 불일치로 던지고 재시도하지 않는다', async () => {
    fetchMock.mockResolvedValueOnce(json(body([{ HOUSE_MANAGE_NO: '1', MODEL_NO: '1' }], 1)))
    await expect(fetchApplyhomeUnits('apt', '1', '1', opts)).rejects.toThrow('스키마 불일치')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('공고 3종을 apt → remainder → urbty 순서로 요청한다', async () => {
    fetchMock.mockImplementation(async () => json(body([], 0)))
    await fetchApplyhomeDetails('2026-01-01', opts)
    const ops = fetchMock.mock.calls.map((c) => String(c[0]).split('?')[0].split('/').pop())
    expect(ops).toEqual(['getAPTLttotPblancDetail', 'getRemndrLttotPblancDetail', 'getUrbtyOfctlLttotPblancDetail'])
  })
})
