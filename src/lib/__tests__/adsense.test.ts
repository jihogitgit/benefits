import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const PUBLISHER_ID = 'ca-pub-7164262890615975'

/** ADSENSE_CLIENT는 모듈 로드 시점에 한 번 계산된다. env를 바꾸려면 모듈을 다시 읽어야 한다. */
async function load(env: { vercelEnv?: string; override?: string }) {
  vi.resetModules()
  if (env.vercelEnv === undefined) delete process.env.VERCEL_ENV
  else process.env.VERCEL_ENV = env.vercelEnv
  if (env.override === undefined) delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT
  else process.env.NEXT_PUBLIC_ADSENSE_CLIENT = env.override
  return import('../adsense')
}

const saved = { v: process.env.VERCEL_ENV, c: process.env.NEXT_PUBLIC_ADSENSE_CLIENT }
beforeEach(() => { vi.resetModules() })
afterEach(() => {
  if (saved.v === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = saved.v
  if (saved.c === undefined) delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT; else process.env.NEXT_PUBLIC_ADSENSE_CLIENT = saved.c
})

describe('ADSENSE_CLIENT', () => {
  it('프로덕션에서는 게시자 ID를 낸다', async () => {
    expect((await load({ vercelEnv: 'production' })).ADSENSE_CLIENT).toBe(PUBLISHER_ID)
  })

  // 로컬·프리뷰에서 내가 띄운 페이지의 노출·클릭은 애드센스가 무효 트래픽으로 보고,
  // 반복되면 계정을 정지한다. 여기가 뚫리면 사고가 나기 전까지 아무 신호도 없다.
  it.each(['preview', 'development', undefined])('VERCEL_ENV=%s 에서는 켜지 않는다', async (vercelEnv) => {
    expect((await load({ vercelEnv })).ADSENSE_CLIENT).toBeUndefined()
  })

  it('env를 주면 프리뷰에서도 그 값이 이긴다', async () => {
    const m = await load({ vercelEnv: 'preview', override: 'ca-pub-0000000000000000' })
    expect(m.ADSENSE_CLIENT).toBe('ca-pub-0000000000000000')
  })

  it('빈 문자열·공백만 있는 env는 설정하지 않은 것으로 본다', async () => {
    // Vercel에서 값을 지우면 빈 문자열로 남는 경우가 있다. 그때 프로덕션 광고가 꺼지면 안 된다.
    expect((await load({ vercelEnv: 'production', override: '   ' })).ADSENSE_CLIENT).toBe(PUBLISHER_ID)
  })
})

describe('ads.txt', () => {
  it('프로덕션에서 ca- 접두사를 뗀 레코드를 낸다', async () => {
    await load({ vercelEnv: 'production' })
    const { GET } = await import('@/app/ads.txt/route')
    const res = GET()
    expect(res.status).toBe(200)
    // 'ca-pub-'을 그대로 쓰면 Google이 레코드를 인식하지 못해 승인 후에도 노출이 0이 된다.
    await expect(res.text()).resolves.toBe('google.com, pub-7164262890615975, DIRECT, f08c47fec0942fa0\n')
  })

  it('광고를 켜지 않은 환경에서는 404를 준다', async () => {
    // 내 ID가 없는 ads.txt가 200으로 응답하면 Google이 도메인 전체의 광고를 차단한다.
    // 파일이 아예 없는 편이 안전하다.
    await load({ vercelEnv: 'preview' })
    const { GET } = await import('@/app/ads.txt/route')
    expect(GET().status).toBe(404)
  })
})
