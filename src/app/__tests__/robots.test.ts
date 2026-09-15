import { describe, it, expect, beforeEach } from 'vitest'
import robots from '../robots'

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

  it('사이트맵은 실제로 생성되는 분할 파일을 가리킨다', () => {
    // /sitemap.xml 인덱스는 Next가 만들지 않는다. 404를 가리키면 안 된다.
    expect(robots().sitemap).toEqual([
      'https://example.com/sitemap/0.xml',
      'https://example.com/sitemap/1.xml',
      'https://example.com/sitemap/2.xml',
      'https://example.com/sitemap/3.xml',
    ])
  })
})
