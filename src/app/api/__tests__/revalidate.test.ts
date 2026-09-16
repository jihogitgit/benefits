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

  // 외부에서 임의 문자열이 들어오는 입구라, 경로가 아닌 값이 revalidatePath로 새지 않아야 한다
  it('/로 시작하지 않는 경로는 버린다', async () => {
    const res = await POST(req({ paths: ['https://evil.example/x', 'guide/abc', '/ok'] }))
    expect(res.status).toBe(200)
    expect(vi.mocked(revalidatePath).mock.calls.map(([p]) => p)).toEqual(['/ok'])
  })

  it('문자열이 아닌 항목은 걸러낸다', async () => {
    await POST(req({ tags: ['guides', 42, null, ''], paths: [] }))
    expect(vi.mocked(revalidateTag).mock.calls.map(([t]) => t)).toEqual(['guides'])
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
