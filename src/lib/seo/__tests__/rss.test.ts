import { describe, it, expect, beforeEach } from 'vitest'
import { buildRss, feedItems, type FeedArticleRow, type FeedGuideRow } from '../rss'

beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com' })

const art = (slug: string, reviewed_at: string | null, over: Partial<FeedArticleRow> = {}): FeedArticleRow => ({
  slug,
  title: `제목 ${slug}`,
  explainer_md: '첫 문단 정의입니다.\n\n# 절\n\n본문',
  status: 'open',
  benefit_articles: { review_status: 'published', indexable: true, reviewed_at },
  ...over,
})
const guide = (slug: string, published_at: string | null): FeedGuideRow => ({ slug, title: `가이드 ${slug}`, body_md: '본문 첫 문장입니다.', published_at })

describe('RSS 피드', () => {
  it('사이트맵과 같은 기준으로 거른다 — 색인하지 않는 페이지는 싣지 않는다', () => {
    const items = feedItems(
      [
        art('ok', '2026-09-01T00:00:00Z'),
        art('draft', '2026-09-02T00:00:00Z', { benefit_articles: { review_status: 'draft', indexable: true, reviewed_at: '2026-09-02T00:00:00Z' } }),
        art('closed', '2026-09-03T00:00:00Z', { status: 'closed' }),
        art('none', null, { benefit_articles: null }),
      ],
      [guide('g', '2026-09-04T00:00:00Z'), guide('unpublished', null)],
    )
    expect(items.map((i) => i.url)).toEqual(['https://example.com/guide/g', 'https://example.com/benefit/ok'])
  })

  it('최신순이고 시각 없는 항목은 끝으로, 상한에서 자른다', () => {
    const items = feedItems([art('a', '2026-09-01T00:00:00Z'), art('b', null), art('c', '2026-09-05T00:00:00Z')], [], 2)
    expect(items.map((i) => i.url)).toEqual(['https://example.com/benefit/c', 'https://example.com/benefit/a'])
  })

  it('한글 슬러그는 퍼센트 인코딩된 주소로 싣는다(canonical과 같은 표기)', () => {
    const [i] = feedItems([art('청년월세', '2026-09-01T00:00:00Z')], [])
    expect(i.url).toBe(`https://example.com/benefit/${encodeURIComponent('청년월세')}`)
  })

  it('설명은 해설 첫 문단만 쓴다', () => {
    const [i] = feedItems([art('a', '2026-09-01T00:00:00Z')], [])
    expect(i.description).toBe('첫 문단 정의입니다.')
  })

  it('XML 특수문자를 이스케이프하고 pubDate는 RFC 822 형식이다', () => {
    const xml = buildRss(feedItems([art('a', '2026-09-01T00:00:00Z', { title: 'A & B <특례>' })], []))
    expect(xml).toContain('<title>A &amp; B &lt;특례&gt;</title>')
    expect(xml).not.toContain('A & B')
    expect(xml).toContain('<pubDate>Tue, 01 Sep 2026 00:00:00 GMT</pubDate>')
    expect(xml).toContain('<atom:link href="https://example.com/rss.xml" rel="self" type="application/rss+xml"/>')
  })
})
