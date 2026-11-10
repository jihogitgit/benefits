import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchLhNotices } from '../lh'

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

  it('네트워크 TypeError는 재시도하고, 3번 실패하면 던진다', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    await expect(fetchLhNotices(opts)).rejects.toThrow('네트워크 오류')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('dsList가 비었는데 ALL_CNT가 더 크면 그 코드는 1번만 요청한다', async () => {
    fetchMock.mockImplementation(async () => empty())
    await fetchLhNotices(opts)
    expect(fetchMock).toHaveBeenCalledTimes(4)
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
})
