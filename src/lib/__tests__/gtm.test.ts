import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// 레이아웃을 import하면 globals.css가 딸려오는데 vitest가 Tailwind v4 PostCSS 설정을
// 읽지 못해 터진다. 스타일은 여기 관심사가 아니므로 빈 모듈로 바꾼다.
vi.mock('../../app/globals.css', () => ({}))

const CONTAINER_ID = 'GTM-T3JBHJZV'

/** GTM_ID는 모듈 로드 시점에 한 번 계산된다. env를 바꾸려면 모듈을 다시 읽어야 한다. */
async function load(env: { vercelEnv?: string; override?: string }) {
  vi.resetModules()
  if (env.vercelEnv === undefined) delete process.env.VERCEL_ENV
  else process.env.VERCEL_ENV = env.vercelEnv
  if (env.override === undefined) delete process.env.NEXT_PUBLIC_GTM_ID
  else process.env.NEXT_PUBLIC_GTM_ID = env.override
  return import('../gtm')
}

const saved = { v: process.env.VERCEL_ENV, g: process.env.NEXT_PUBLIC_GTM_ID, a: process.env.NEXT_PUBLIC_GA_ID }
beforeEach(() => { vi.resetModules() })
afterEach(() => {
  if (saved.v === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = saved.v
  if (saved.g === undefined) delete process.env.NEXT_PUBLIC_GTM_ID; else process.env.NEXT_PUBLIC_GTM_ID = saved.g
  if (saved.a === undefined) delete process.env.NEXT_PUBLIC_GA_ID; else process.env.NEXT_PUBLIC_GA_ID = saved.a
})

describe('GTM_ID', () => {
  it('프로덕션에서는 컨테이너 ID를 낸다', async () => {
    expect((await load({ vercelEnv: 'production' })).GTM_ID).toBe(CONTAINER_ID)
  })

  // 로컬·프리뷰에서 내가 띄운 페이지의 세션이 GA4 속성에 쌓이면, 유입을 판단하려고 붙인
  // 계측이 자기 트래픽을 재게 된다. 광고와 달리 화면에 흔적이 없어 새는 것을 알기 어렵다.
  it.each(['preview', 'development', undefined])('VERCEL_ENV=%s 에서는 켜지 않는다', async (vercelEnv) => {
    expect((await load({ vercelEnv })).GTM_ID).toBeUndefined()
  })

  it('env를 주면 프리뷰에서도 그 값이 이긴다', async () => {
    expect((await load({ vercelEnv: 'preview', override: 'GTM-TEST0000' })).GTM_ID).toBe('GTM-TEST0000')
  })

  it('빈 문자열·공백만 있는 env는 설정하지 않은 것으로 본다', async () => {
    // Vercel에서 값을 지우면 빈 문자열로 남는 경우가 있다. 그때 프로덕션 계측이 꺼지면 안 된다.
    expect((await load({ vercelEnv: 'production', override: '   ' })).GTM_ID).toBe(CONTAINER_ID)
  })
})

/** 루트 레이아웃의 서버 렌더 결과. GTM 스니펫이 HTML에 실제로 들어가는지 본다. */
async function renderLayout() {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { default: RootLayout } = await import('@/app/layout')
  return renderToStaticMarkup(RootLayout({ children: null }))
}

describe('레이아웃의 GTM 스니펫', () => {
  // next/script의 beforeInteractive는 앱 라우터에서 인라인을 받으면 스니펫을 실행하는 태그를
  // 내보내지 않고 self.__next_s에 JSON으로 밀어넣는다. 그러면 태그 어시스턴트와 GTM 설치
  // 확인이 스니펫을 못 찾는다. 평범한 script 태그여야 글자 그대로 HTML에 남는다.
  it('서버 렌더 HTML에 gtm.js를 부르는 인라인 script가 들어간다', async () => {
    await load({ vercelEnv: 'production' })
    const html = await renderLayout()
    expect(html).toContain('www.googletagmanager.com/gtm.js?id=')
    expect(html).toContain(CONTAINER_ID)
    // __next_s로 감싸이면 실행이 Next 런타임에 맡겨진다 — 그 경로로 새지 않았는지 본다.
    expect(html).not.toContain('__next_s')
  })

  it('noscript iframe도 같은 컨테이너를 가리킨다', async () => {
    await load({ vercelEnv: 'production' })
    expect(await renderLayout()).toContain(`https://www.googletagmanager.com/ns.html?id=${CONTAINER_ID}`)
  })

  it('켜지 않은 환경에서는 스니펫을 넣지 않는다', async () => {
    await load({ vercelEnv: 'preview' })
    expect(await renderLayout()).not.toContain('googletagmanager')
  })

  it('켜지 않은 환경에서는 noscript iframe도 넣지 않는다', async () => {
    await load({ vercelEnv: 'preview' })
    expect(await renderLayout()).not.toContain('ns.html')
  })
})

// GTM과 gtag 직접 연결을 동시에 켜면 페이지뷰가 두 번 잡힌다. gtag 쪽은 afterInteractive라
// 서버 렌더 HTML에 흔적을 남기지 않아 렌더 결과로는 증명할 수 없다 — 판정 함수로 확인한다.
describe('analyticsPath', () => {
  it('GTM이 있으면 GTM만 쓴다 (GA_ID가 같이 설정돼 있어도)', async () => {
    const { analyticsPath } = await load({ vercelEnv: 'production' })
    expect(analyticsPath({ gtm: 'GTM-T3JBHJZV', gaId: 'G-TEST0000' })).toBe('gtm')
  })

  it('GTM이 없으면 gtag 직접 연결로 떨어진다', async () => {
    const { analyticsPath } = await load({ vercelEnv: 'production' })
    expect(analyticsPath({ gaId: 'G-TEST0000' })).toBe('gtag')
  })

  it('둘 다 없으면 계측이 없다', async () => {
    const { analyticsPath } = await load({ vercelEnv: 'production' })
    expect(analyticsPath({})).toBe('none')
  })
})
