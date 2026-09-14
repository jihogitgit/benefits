import { describe, it, expect, beforeEach } from 'vitest'
import { benefitEntries, regionHubEntries, staticEntries, sitemapPaths } from '../sitemap-entries'

beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com' })

describe('sitemap entries', () => {
  it('상세는 색인 가능한 것만, lastmod는 원문 수정·검수 중 최신', () => {
    const rows = [
      { slug: 'a', status: 'open', source_updated_at: '2026-09-01T00:00:00Z', benefit_articles: { review_status: 'published', indexable: true, reviewed_at: '2026-09-05T00:00:00Z' } },
      { slug: 'b', status: 'open', source_updated_at: '2026-09-01T00:00:00Z', benefit_articles: null },
      { slug: 'c', status: 'closed', source_updated_at: '2026-09-01T00:00:00Z', benefit_articles: { review_status: 'published', indexable: true, reviewed_at: null } },
    ]
    const e = benefitEntries(rows)
    expect(e.map((x) => x.url)).toEqual(['https://example.com/benefit/a'])
    expect(e[0].lastModified).toEqual(new Date('2026-09-05T00:00:00Z'))
  })
  it('세그먼트×지역은 항목 3개 이상 + 안내문 있는 것만', () => {
    const e = regionHubEntries(
      [{ segmentPath: 'youth', regionSlug: 'seoul', count: 5 }, { segmentPath: 'youth', regionSlug: 'jeju', count: 2 }, { segmentPath: 'parenting', regionSlug: 'seoul', count: 9 }],
      { seoul: '서울 안내', jeju: '제주 안내' },
    )
    expect(e.map((x) => x.url)).toEqual(['https://example.com/youth/seoul', 'https://example.com/parenting/seoul'])
  })
  it('정적 항목에 홈·세그먼트 3개·마감·필수 페이지 포함, /my 제외', () => {
    const urls = staticEntries().map((x) => x.url)
    expect(urls).toContain('https://example.com/')
    expect(urls).toContain('https://example.com/small-biz')
    expect(urls).toContain('https://example.com/deadline')
    expect(urls).toContain('https://example.com/about')
    expect(urls.some((u) => u.endsWith('/my'))).toBe(false)
  })
})

describe('sitemapPaths', () => {
  it('정적/지역 허브 1개 + 공개 세그먼트 3개 = 4개 경로', () => {
    expect(sitemapPaths()).toEqual(['/sitemap/0.xml', '/sitemap/1.xml', '/sitemap/2.xml', '/sitemap/3.xml'])
  })
})
