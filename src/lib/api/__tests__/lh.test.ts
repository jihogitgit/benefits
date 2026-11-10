import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchLhNotices } from '../lh'
import { DeadlineError } from '../applyhome'

const row = (id: string, all = 1) => ({ PAN_ID: id, PAN_NM: `공고 ${id}`, ALL_CNT: String(all) })
const body = (rows: unknown[]) => [{ resHeader: [{ SS_CODE: 'Y' }] }, { dsList: rows }]
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
const empty = () => json(body([]))
const opts = { delayMs: 0, retryBaseMs: 0 }
const cdOf = (call: unknown[]) => new URL(String(call[0])).searchParams.get('UPP_AIS_TP_CD')

describe('LH 클라이언트', () => {
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

  it('ALL_CNT 150, pageSize 100이면 2페이지를 받아 합친다', async () => {
    const first = Array.from({ length: 100 }, (_, i) => row(`a${i}`, 150))
    const second = Array.from({ length: 50 }, (_, i) => row(`b${i}`, 150))
    fetchMock
      .mockResolvedValueOnce(json(body(first)))
      .mockResolvedValueOnce(json(body(second)))
      .mockImplementation(async () => empty())
    const r = await fetchLhNotices({ ...opts, pageSize: 100 })
    expect(fetchMock).toHaveBeenCalledTimes(2 + 3)
    expect(r).toHaveLength(150)
  })

  it('UPP_AIS_TP_CD를 05, 06, 13, 39 순서로 보낸다', async () => {
    fetchMock.mockImplementation(async () => empty())
    await fetchLhNotices(opts)
    expect(fetchMock.mock.calls.map(cdOf)).toEqual(['05', '06', '13', '39'])
  })

  it('403 XML 본문이면 재시도 없이 던진다', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<OpenAPI_ServiceResponse>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</OpenAPI_ServiceResponse>', { status: 403 }))
    await expect(fetchLhNotices(opts)).rejects.toThrow('HTTP 403')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('403 오류 메시지에 키(URL)가 들어가지 않는다', async () => {
    fetchMock.mockResolvedValueOnce(new Response('denied', { status: 403 }))
    const err = await fetchLhNotices(opts).catch((e: Error) => e)
    expect((err as Error).message).not.toContain('test-key')
    expect((err as Error).message).not.toContain('serviceKey')
  })

  it('JSON이 아닌 200 본문이면 던진다', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<xml/>', { status: 200 }))
    await expect(fetchLhNotices(opts)).rejects.toThrow('JSON이 아님')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('스키마 불일치는 재시도 없이 던진다', async () => {
    fetchMock.mockResolvedValueOnce(json({ dsList: [{ PAN_NM: '이름만' }] }))
    await expect(fetchLhNotices(opts)).rejects.toThrow('스키마 불일치')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('503 다음 200이면 성공한다', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(json(body([row('x')])))
      .mockImplementation(async () => empty())
    const r = await fetchLhNotices(opts)
    expect(r.map((x) => x.PAN_ID)).toEqual(['x'])
    expect(fetchMock).toHaveBeenCalledTimes(2 + 3)
  })

  it('요청 시간 초과(TimeoutError) 뒤 200이면 재시도로 성공한다', async () => {
    fetchMock
      .mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'TimeoutError' }))
      .mockResolvedValueOnce(json(body([row('x')])))
      .mockImplementation(async () => empty())
    const r = await fetchLhNotices(opts)
    expect(r.map((x) => x.PAN_ID)).toEqual(['x'])
    expect(fetchMock).toHaveBeenCalledTimes(2 + 3)
  })

  it('네트워크 TypeError는 재시도하고, 3번 실패하면 던진다', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    await expect(fetchLhNotices(opts)).rejects.toThrow('네트워크 오류')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  const rows = (prefix: string, n: number, all?: string) =>
    Array.from({ length: n }, (_, i) => ({ PAN_ID: `${prefix}${i}`, ...(all ? { ALL_CNT: all } : {}) }))
  const firstCodeCalls = () => fetchMock.mock.calls.filter((c) => cdOf(c) === '05').length

  it('빈 페이지에서 멈춘다(ALL_CNT 500, 2페이지째 비어 있음)', async () => {
    fetchMock
      .mockImplementationOnce(async () => json(body(rows('a', 100, '500'))))
      .mockImplementation(async () => empty())
    await fetchLhNotices(opts)
    expect(firstCodeCalls()).toBe(2)
  })

  it('ALL_CNT가 없으면 가득 찬 페이지가 이어지는 동안 받는다', async () => {
    fetchMock
      .mockImplementationOnce(async () => json(body(rows('a', 100))))
      .mockImplementationOnce(async () => json(body(rows('b', 30))))
      .mockImplementation(async () => empty())
    const r = await fetchLhNotices(opts)
    expect(r).toHaveLength(130)
    expect(firstCodeCalls()).toBe(2)
  })

  it("ALL_CNT가 '0'이어도 같다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json(body(rows('a', 100, '0'))))
      .mockImplementationOnce(async () => json(body(rows('b', 30, '0'))))
      .mockImplementation(async () => empty())
    const r = await fetchLhNotices(opts)
    expect(r).toHaveLength(130)
    expect(firstCodeCalls()).toBe(2)
  })

  it('200 응답의 SS_CODE가 N이면 재시도 없이 던진다', async () => {
    fetchMock.mockImplementation(async () => json([{ resHeader: [{ SS_CODE: 'N', RS_MSG: '오류' }] }]))
    await expect(fetchLhNotices(opts)).rejects.toThrow('API 오류')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('전체 건수는 첫 페이지 값으로 고정한다', async () => {
    fetchMock
      .mockImplementationOnce(async () => json(body(rows('a', 100, '150'))))
      .mockImplementationOnce(async () => json(body(rows('b', 50, '9999'))))
      .mockImplementation(async () => empty())
    const r = await fetchLhNotices(opts)
    expect(r).toHaveLength(150)
    expect(firstCodeCalls()).toBe(2)
  })

  it('페이지 상한(10)을 넘으면 던진다', async () => {
    fetchMock.mockImplementation(async () => json(body(rows('a', 100))))
    const err = await fetchLhNotices(opts).catch((e: Error) => e)
    expect((err as Error).message).toContain('lh 05 페이지 상한 10 초과(ALL_CNT=미상)')
    expect((err as Error).message).not.toContain('serviceKey')
    expect((err as Error).message).not.toContain('test-key')
    expect(firstCodeCalls()).toBe(10)
  })

  it('전체 건수와 정확히 맞게 찬 마지막 페이지에서 멈춘다', async () => {
    fetchMock
      .mockImplementationOnce(async () => json(body(rows('a', 100, '200'))))
      .mockImplementationOnce(async () => json(body(rows('b', 100, '200'))))
      .mockImplementation(async () => empty())
    const r = await fetchLhNotices(opts)
    expect(r).toHaveLength(200)
    expect(firstCodeCalls()).toBe(2)
  })

  it('PAN_ID로 중복을 제거한다(첫 번째 유지)', async () => {
    const first = Array.from({ length: 100 }, (_, i) => row(`p${i}`, 101))
    fetchMock
      .mockResolvedValueOnce(json(body(first)))
      .mockResolvedValueOnce(json(body([{ ...row('p99', 101), PAN_NM: '중복' }])))
      .mockImplementation(async () => empty())
    const r = await fetchLhNotices(opts)
    expect(r).toHaveLength(100)
    expect(r.find((x) => x.PAN_ID === 'p99')?.PAN_NM).toBe('공고 p99')
  })

  it('시간 예산이 이미 지났으면 요청 없이 시간 예산 초과로 던진다', async () => {
    fetchMock.mockImplementation(async () => empty())
    await expect(fetchLhNotices({ ...opts, deadlineMs: Date.now() - 1 })).rejects.toThrow(DeadlineError)
    expect(fetchMock).toHaveBeenCalledTimes(0)
  })

  it('마감이 100ms 남았으면 503에도 재시도하지 않고 던진다', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockImplementation(async () => empty())
    await expect(fetchLhNotices({ ...opts, deadlineMs: Date.now() + 100 })).rejects.toThrow('HTTP 503')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('페이지 사이에서 마감이 지나면 다음 페이지를 요청하지 않는다', async () => {
    const deadlineMs = Date.now() + 60_000
    fetchMock.mockImplementation(async () => {
      vi.setSystemTime(deadlineMs + 1)
      return json(body(rows('a', 100, '500')))
    })
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      await expect(fetchLhNotices({ ...opts, deadlineMs })).rejects.toThrow('시간 예산 초과')
    } finally {
      vi.useRealTimers()
    }
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
