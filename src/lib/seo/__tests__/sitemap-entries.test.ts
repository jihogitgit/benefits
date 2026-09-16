import { describe, it, expect, beforeEach } from 'vitest'
import { benefitEntries, guideEntries, regionHubEntries, staticEntries, sitemapPaths } from '../sitemap-entries'

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
  it('세그먼트×지역은 지역 전용 10건 이상 + 안내문 있는 것만', () => {
    const e = regionHubEntries(
      [{ segmentPath: 'youth', regionSlug: 'seoul', localCount: 51 }, { segmentPath: 'youth', regionSlug: 'gwangju', localCount: 1 }, { segmentPath: 'parenting', regionSlug: 'seoul', localCount: 360 }],
      { seoul: '서울 안내', gwangju: '광주 안내' },
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
  it('정적·지역 허브 항목은 lastmod를 신고하지 않는다 (매시간 갱신으로 보이면 신호가 무시된다)', () => {
    expect(staticEntries().every((e) => e.lastModified === undefined)).toBe(true)
    const hubs = regionHubEntries([{ segmentPath: 'youth', regionSlug: 'seoul', localCount: 51 }], { seoul: '서울 안내' })
    expect(hubs.every((e) => e.lastModified === undefined)).toBe(true)
  })
})

describe('sitemapPaths', () => {
  it('정적/지역 허브 1개 + 공개 세그먼트 3개 = 4개 경로', () => {
    expect(sitemapPaths()).toEqual(['/sitemap/0.xml', '/sitemap/1.xml', '/sitemap/2.xml', '/sitemap/3.xml'])
  })
})

describe('guideEntries', () => {
  it('발행된 가이드만 싣는다', () => {
    // /guide/[slug]는 published_at이 없으면 notFound()를 낸다. 이 기준이 어긋나면
    // 사이트맵이 404를 신고하게 된다.
    const rows = [
      { slug: 'a', published_at: '2026-09-01T00:00:00Z' },
      { slug: 'b', published_at: null },
    ]
    const entries = guideEntries(rows)
    expect(entries.map((e) => e.url)).toEqual(['https://example.com/guide/a'])
  })

  it('published_at을 lastmod로 쓴다', () => {
    const [e] = guideEntries([{ slug: 'a', published_at: '2026-09-01T00:00:00Z' }])
    expect(e.lastModified).toEqual(new Date('2026-09-01T00:00:00Z'))
  })

  it('가이드가 없으면 빈 배열', () => {
    expect(guideEntries([])).toEqual([])
  })
})
