import { absoluteUrl, siteName, siteUrl, SITE_DESCRIPTION } from './site'
import { benefitIndexable, guideIndexable } from './index-policy'
import { metaDescription } from './meta-description'

/**
 * /rss.xml 본문. 네이버 서치어드바이저에 RSS를 제출하면 새 글이 사이트맵보다 빨리 수집된다.
 *
 * 싣는 대상은 사이트맵과 같은 기준을 따른다 — 해설이 발행된 상세, 발행된 가이드.
 * 색인하지 않는 페이지를 피드에 올리면 "빨리 가져가라"와 "색인하지 말라"를 동시에 말하게 된다.
 */

export const FEED_LIMIT = 50

export interface FeedArticleRow {
  slug: string
  title: string
  /** 설명은 해설 첫 문단에서 뽑는다. 정부24 summary는 낡은 숫자를 싣고 있는 경우가 있다
   *  (주거안정 월세대출 summary의 "연 960만원 한도" — 현재 1,440만원). 해설은 그걸 바로잡은 글이다. */
  explainer_md: string | null
  status: string
  benefit_articles: { review_status: string; indexable: boolean; reviewed_at: string | null } | null
}

export interface FeedGuideRow {
  slug: string
  title: string
  body_md: string
  published_at: string | null
}

export interface FeedItem {
  title: string
  url: string
  description: string
  /** ISO 시각. 없으면 pubDate를 싣지 않고 목록 끝으로 보낸다. */
  date: string | null
}

export function feedItems(articles: FeedArticleRow[], guides: FeedGuideRow[], limit = FEED_LIMIT): FeedItem[] {
  const items: FeedItem[] = [
    ...articles
      .filter((a) => benefitIndexable({ status: a.status, article: a.benefit_articles }))
      .map((a) => ({
        title: a.title,
        url: absoluteUrl(`/benefit/${a.slug}`),
        description: metaDescription(a.explainer_md?.split(/\n\s*\n/)[0] ?? ''),
        date: a.benefit_articles?.reviewed_at ?? null,
      })),
    ...guides.filter(guideIndexable).map((g) => ({
      title: g.title,
      url: absoluteUrl(`/guide/${g.slug}`),
      description: metaDescription(g.body_md),
      date: g.published_at,
    })),
  ]
  // 최신순. 시각이 같으면 URL로 고정해 재생성마다 순서가 흔들리지 않게 한다.
  const t = (d: string | null) => (d ? new Date(d).getTime() : -Infinity)
  return items.sort((a, b) => t(b.date) - t(a.date) || a.url.localeCompare(b.url)).slice(0, limit)
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export function buildRss(items: FeedItem[]): string {
  const latest = items.find((i) => i.date)?.date
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '<channel>',
    `<title>${esc(siteName())}</title>`,
    `<link>${esc(`${siteUrl()}/`)}</link>`,
    `<description>${esc(SITE_DESCRIPTION)}</description>`,
    '<language>ko</language>',
    `<atom:link href="${esc(absoluteUrl('/rss.xml'))}" rel="self" type="application/rss+xml"/>`,
    ...(latest ? [`<lastBuildDate>${new Date(latest).toUTCString()}</lastBuildDate>`] : []),
    ...items.map((i) =>
      [
        '<item>',
        `<title>${esc(i.title)}</title>`,
        `<link>${esc(i.url)}</link>`,
        `<guid isPermaLink="true">${esc(i.url)}</guid>`,
        `<description>${esc(i.description)}</description>`,
        ...(i.date ? [`<pubDate>${new Date(i.date).toUTCString()}</pubDate>`] : []),
        '</item>',
      ].join(''),
    ),
    '</channel>',
    '</rss>',
    '',
  ].join('\n')
}
