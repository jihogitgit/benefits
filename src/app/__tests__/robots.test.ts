import { describe, it, expect, beforeEach } from 'vitest'
import robots from '../robots'
import { GET as sitemapIndex } from '../sitemap.xml/route'
import { sitemapPaths } from '@/lib/seo/sitemap-entries'

beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com' })

describe('robots.txt', () => {
  it('noindex로 막는 경로는 Disallow하지 않는다', () => {
    // Disallow + noindex를 같이 걸면 크롤러가 noindex를 읽지 못해 URL만 색인될 수 있다.
    // /my는 페이지가 noindex를 내므로 크롤은 허용해야 한다.
    const rules = robots().rules
    const disallow = (Array.isArray(rules) ? rules : [rules]).flatMap((r) => {
      const d = r.disallow
      return d === undefined ? [] : Array.isArray(d) ? d : [d]
    })
    expect(disallow).not.toContain('/my')
    expect(disallow).toContain('/api/')
  })

  it('사이트맵은 실제로 응답하는 주소만 가리킨다', () => {
    // 404를 가리키면 안 된다. 인덱스(/sitemap.xml)는 Next가 만들어 주지 않으므로
    // app/sitemap.xml/route.ts가 직접 연다 — 아래 테스트가 그 라우트의 존재까지 묶어서 지킨다.
    expect(robots().sitemap).toEqual([
      'https://example.com/sitemap.xml',
      'https://example.com/sitemap/0.xml',
      'https://example.com/sitemap/1.xml',
      'https://example.com/sitemap/2.xml',
      'https://example.com/sitemap/3.xml',
    ])
  })

  it('robots가 가리키는 인덱스가 실제로 열리고, 분할 파일 전부를 담는다', async () => {
    const res = sitemapIndex()
    expect(res.status).toBe(200)
    // 등록 도구가 content-type으로 형식을 판정한다
    expect(res.headers.get('content-type')).toBe('application/xml')

    const body = await res.text()
    const locs = [...body.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])
    expect(locs).toEqual(sitemapPaths().map((p) => `https://example.com${p}`))

    // robots가 인덱스를 선언했다면 그 인덱스가 실제로 존재해야 한다(이 둘이 갈라지는 것이 핵심 위험)
    const declared = robots().sitemap as string[]
    expect(declared).toContain('https://example.com/sitemap.xml')
    // 인덱스를 따라가지 않는 크롤러를 위해 분할 파일도 robots에 남아 있어야 한다
    for (const l of locs) expect(declared).toContain(l)
  })
})
