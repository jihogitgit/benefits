import type { MetadataRoute } from 'next'
import { absoluteUrl } from './site'
import { benefitIndexable, compareIndexable, guideIndexable, regionHubIndexable } from './index-policy'
import { PUBLIC_SEGMENTS } from '../../../data/segments'

type Entry = MetadataRoute.Sitemap[number]

/**
 * 사이트맵 분할 id. 0 = 정적 + 지역 허브, 1..n = 공개 세그먼트별 상세.
 * generateSitemaps와 robots가 같은 목록을 봐야 robots가 없는 파일을 가리키지 않는다.
 */
export const SITEMAP_IDS: number[] = [0, ...PUBLIC_SEGMENTS.map((_, i) => i + 1)]

/** Next가 만드는 실제 경로. generateSitemaps는 /sitemap/{id}.xml만 내고 /sitemap.xml 인덱스는 내지 않는다. */
export function sitemapPaths(): string[] {
  return SITEMAP_IDS.map((id) => `/sitemap/${id}.xml`)
}

export interface BenefitSitemapRow {
  slug: string
  status: string
  source_updated_at: string | null
  benefit_articles: { review_status: string; indexable: boolean; reviewed_at: string | null } | null
}

export function benefitEntries(rows: BenefitSitemapRow[]): Entry[] {
  return rows
    .filter((r) => benefitIndexable({ status: r.status, article: r.benefit_articles }))
    .map((r) => {
      const times = [r.source_updated_at, r.benefit_articles?.reviewed_at].filter((t): t is string => !!t).map((t) => new Date(t).getTime())
      return { url: absoluteUrl(`/benefit/${r.slug}`), lastModified: times.length ? new Date(Math.max(...times)) : new Date(), changeFrequency: 'weekly', priority: 0.8 }
    })
}

// lastmod는 사이트맵에서 선택 항목이다. 정적·허브 페이지에는 신뢰할 만한 수정 시각이 없는데
// new Date()를 쓰면 revalidate(1시간)마다 /privacy까지 "방금 바뀐" 것으로 신고하게 되고,
// 검색엔진이 이 사이트의 lastmod 신호를 통째로 무시하면 상세 항목에 대해 source_updated_at·
// reviewed_at으로 정확히 계산해 둔 lastmod까지 함께 버려진다. 없는 편이 부정확한 값보다 낫다.
export function regionHubEntries(counts: { segmentPath: string; regionSlug: string; localCount: number }[], descriptions: Record<string, string | null>): Entry[] {
  return counts
    .filter((c) => regionHubIndexable({ localCount: c.localCount, description_md: descriptions[c.regionSlug] ?? null }))
    .map((c) => ({ url: absoluteUrl(`/${c.segmentPath}/${c.regionSlug}`), changeFrequency: 'daily', priority: 0.7 }))
}

export interface GuideSitemapRow {
  slug: string
  published_at: string | null
}

/**
 * 발행된 가이드. 정적·허브 항목과 달리 published_at이라는 실제 시각이 있으므로 lastmod를 싣는다
 * (부정확한 lastmod를 쓰지 않는 이유는 아래 주석 참고).
 */
export function guideEntries(rows: GuideSitemapRow[]): Entry[] {
  return rows.filter(guideIndexable).map((g) => ({
    url: absoluteUrl(`/guide/${g.slug}`),
    lastModified: new Date(g.published_at as string),
    changeFrequency: 'monthly',
    priority: 0.6,
  }))
}

/**
 * 비교 페이지. 열쇠를 여기서 인코딩하지 않는다 — absoluteUrl이 경로 조각마다 이미 한다.
 * 한 번 더 걸면 '%'가 다시 '%25'로 인코딩되어 사이트맵 전체가 없는 주소를 가리킨다
 * (한글 슬러그를 그대로 넘기는 guideEntries와 같은 규칙이다).
 *
 * lastmod는 싣지 않는다. 묶음은 제목에서 계산된 값이라 "언제 바뀌었나"에 해당하는 시각이 없다.
 */
export function compareEntries(groups: { key: string; regionCount: number }[]): Entry[] {
  return groups
    .filter(compareIndexable)
    .map((g) => ({ url: absoluteUrl(`/compare/${g.key}`), changeFrequency: 'weekly' as const, priority: 0.6 }))
}

export function staticEntries(): Entry[] {
  return [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1.0 },
    ...PUBLIC_SEGMENTS.map((s) => ({ url: absoluteUrl(`/${s.path}`), changeFrequency: 'daily' as const, priority: 0.9 })),
    { url: absoluteUrl('/guide'), changeFrequency: 'weekly', priority: 0.8 },
    { url: absoluteUrl('/deadline'), changeFrequency: 'daily', priority: 0.8 },
    { url: absoluteUrl('/about'), changeFrequency: 'yearly', priority: 0.3 },
    { url: absoluteUrl('/contact'), changeFrequency: 'yearly', priority: 0.2 },
    { url: absoluteUrl('/privacy'), changeFrequency: 'yearly', priority: 0.1 },
    { url: absoluteUrl('/terms'), changeFrequency: 'yearly', priority: 0.1 },
  ]
}
