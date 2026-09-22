import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { GuideRow } from '@/lib/benefits/queries'

const getGuide = vi.fn<(slug: string) => Promise<GuideRow | null>>()
vi.mock('@/lib/benefits/queries', () => ({ getGuide: (slug: string) => getGuide(slug) }))

const guide = (over: Partial<GuideRow> = {}): GuideRow => ({
  slug: '국가장학금-탈락-소득-성적-횟수별-대안',
  title: '국가장학금에서 떨어졌다면, 소득을 아예 안 보는 장학금이 255개 있습니다',
  seo_title: null,
  body_md: '국가장학금에서 떨어지는 이유는 셋입니다. 소득이 넘거나, 성적이 안 되거나입니다.',
  segment: 'youth',
  published_at: '2026-09-17T00:00:00Z',
  updated_at: null,
  ...over,
})

async function meta(row: GuideRow | null) {
  getGuide.mockResolvedValue(row)
  const { generateMetadata } = await import('../page')
  return generateMetadata({ params: Promise.resolve({ slug: 'x' }) })
}

beforeEach(() => {
  vi.resetModules()
  getGuide.mockReset()
})

describe('가이드 <title>', () => {
  it('seo_title이 없으면 본문 제목을 쓴다 (브랜드 접미사는 레이아웃 template이 붙인다)', async () => {
    expect((await meta(guide())).title).toBe(guide().title)
  })

  /*
    absolute여야 한다. 평범한 문자열로 두면 루트 레이아웃의 template이 ' | 내몫'을 덧붙이는데,
    한글 검색결과가 잘리는 30자 안에서 브랜드에 5자를 쓰면 클릭 이유인 숫자가 절단선 뒤로 간다.
    이 단언이 깨지면 그건 스타일 문제가 아니라 검색결과에서 제목 끝이 잘리는 회귀다.
  */
  it('seo_title이 있으면 absolute로 내보내 브랜드 접미사를 뗀다', async () => {
    const t = '국가장학금 탈락 후, 소득 안 보는 장학금 255개'
    expect((await meta(guide({ seo_title: t }))).title).toEqual({ absolute: t })
  })

  it('공백만 있는 seo_title은 설정하지 않은 것으로 본다', async () => {
    // 대시보드에서 값을 지우면 빈 문자열로 남는 경우가 있다. 그때 제목이 비면 안 된다.
    expect((await meta(guide({ seo_title: '   ' }))).title).toBe(guide().title)
  })

  it('앞뒤 공백은 떼고 내보낸다', async () => {
    expect((await meta(guide({ seo_title: '  짧은 제목  ' }))).title).toEqual({ absolute: '짧은 제목' })
  })

  it('발행 전이거나 없는 가이드는 메타를 내지 않는다', async () => {
    expect(await meta(null)).toEqual({})
    expect(await meta(guide({ published_at: null, seo_title: '무시돼야 한다' }))).toEqual({})
  })

  it('description은 seo_title이 아니라 본문에서 만든다', async () => {
    const m = await meta(guide({ seo_title: '짧은 제목' }))
    expect(m.description).toContain('국가장학금에서 떨어지는 이유는 셋입니다')
  })

  it('canonical은 seo_title과 무관하게 그 가이드 슬러그를 가리킨다', async () => {
    // 호스트는 NEXT_PUBLIC_SITE_URL에 달려 있고(테스트 환경에서는 localhost), 퍼센트 인코딩은
    // absoluteUrl의 일이다(site.test.ts가 본다). 여기서 지킬 것은 경로가 그 가이드라는 것뿐이다.
    const m = await meta(guide({ seo_title: '짧은 제목' }))
    expect(String(m.alternates?.canonical)).toBe(
      `${new URL(String(m.alternates?.canonical)).origin}/guide/${encodeURIComponent('국가장학금-탈락-소득-성적-횟수별-대안')}`,
    )
  })
})
