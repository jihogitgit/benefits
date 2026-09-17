import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }))

import { revalidateTag, revalidatePath } from 'next/cache'
import { POST } from '../revalidate/route'

const SECRET = 'test-secret'

function req(body: unknown, auth = `Bearer ${SECRET}`): Request {
  return new Request('https://naemok.com/api/revalidate', {
    method: 'POST',
    headers: { authorization: auth, 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/revalidate', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET
    vi.mocked(revalidateTag).mockClear()
    vi.mocked(revalidatePath).mockClear()
  })

  it('비밀키가 틀리면 401이고 아무것도 무효화하지 않는다', async () => {
    const res = await POST(req({ tags: ['guides'] }, 'Bearer wrong'))
    expect(res.status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('태그와 경로를 모두 무효화한다', async () => {
    const res = await POST(req({ tags: ['guides'], paths: ['/guide/abc', '/'] }))
    expect(res.status).toBe(200)
    expect(revalidateTag).toHaveBeenCalledWith('guides')
    expect(revalidatePath).toHaveBeenCalledWith('/guide/abc')
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  // 외부에서 임의 문자열이 들어오는 입구라, 경로가 아닌 값이 revalidatePath로 새지 않아야 한다.
  // 버리지 않고 거절하는 이유: 버리면 호출자는 자기가 보낸 경로가 처리된 줄 안다.
  it('/로 시작하지 않는 경로는 버리지 않고 거절한다', async () => {
    const res = await POST(req({ paths: ['https://evil.example/x', 'guide/abc', '/ok'] }))
    expect(res.status).toBe(400)
    expect((await res.json()).invalid).toEqual(['https://evil.example/x', 'guide/abc'])
    // 하나라도 이상하면 멀쩡한 /ok도 돌리지 않는다
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('프로토콜 상대 경로(//)도 거절한다', async () => {
    const res = await POST(req({ paths: ['//evil.example/x'] }))
    expect(res.status).toBe(400)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('문자열이 아닌 항목이 섞이면 거절한다', async () => {
    const res = await POST(req({ tags: ['guides', 42, null, ''], paths: [] }))
    expect(res.status).toBe(400)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  // 배열을 빼먹는 것이 가장 흔한 실수다. 조용히 []로 바꾸면 검증할 것이 사라져 오타가
  // 그대로 ok:true가 된다 — 이 엔드포인트를 고치려던 바로 그 사고가 다른 축에서 재현된다.
  it('tags가 배열이 아니면 거절한다 (ok:true로 통과하면 안 된다)', async () => {
    const res = await POST(req({ tags: 'benefits:all', paths: ['/'] }))
    expect(res.status).toBe(400)
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('paths가 배열이 아니면 거절한다', async () => {
    const res = await POST(req({ tags: ['guides'], paths: '/' }))
    expect(res.status).toBe(400)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('항목이 너무 많으면 거절한다', async () => {
    const res = await POST(req({ paths: Array.from({ length: 51 }, (_, i) => `/p${i}`) }))
    expect(res.status).toBe(400)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('호출자가 보낸 값을 그대로 되돌려준다 — 스크립트가 이걸로 누락을 잡는다', async () => {
    const res = await POST(req({ tags: ['guides'], paths: ['/a', '/b'] }))
    expect(await res.json()).toEqual({ ok: true, tags: ['guides'], paths: ['/a', '/b'] })
  })

  // 존재하지 않는 태그를 통과시키면 revalidateTag가 조용히 성공해, 호출자는 무효화됐다고
  // 믿지만 낡은 응답이 계속 나간다. 실제로 겪은 사고라 회귀로 고정한다.
  it('알 수 없는 태그는 400이고 아무것도 무효화하지 않는다', async () => {
    const res = await POST(req({ tags: ['benefits', 'benefit-articles', 'sitemap'] }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.unknown).toEqual(['benefits', 'benefit-articles', 'sitemap'])
    expect(body.valid).toContain('benefits:all')
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('유효한 태그 하나라도 섞여 있으면 전부 거절한다 — 일부만 도는 것이 더 위험하다', async () => {
    const res = await POST(req({ tags: ['benefits:all', 'sitemap'], paths: ['/'] }))
    expect(res.status).toBe(400)
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('실제로 쓰는 태그 4종은 모두 통과한다', async () => {
    const res = await POST(req({ tags: ['benefits:all', 'benefits:home', 'guides', 'regions'] }))
    expect(res.status).toBe(200)
    expect(vi.mocked(revalidateTag).mock.calls.map(([t]) => t)).toEqual(['benefits:all', 'benefits:home', 'guides', 'regions'])
  })

  it('tags도 paths도 없으면 400이다', async () => {
    const res = await POST(req({ tags: [], paths: [] }))
    expect(res.status).toBe(400)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('JSON이 아니면 400이다', async () => {
    const res = await POST(req('{not json'))
    expect(res.status).toBe(400)
  })
})
