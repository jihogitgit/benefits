import { absoluteUrl } from './site'

export function governmentService(b: {
  title: string
  summary: string | null
  agency: string | null
  region_name: string | null
  apply_url: string | null
  slug: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'GovernmentService',
    name: b.title,
    description: b.summary ?? undefined,
    provider: b.agency ? { '@type': 'GovernmentOrganization', name: b.agency } : undefined,
    areaServed: b.region_name ?? '대한민국',
    url: absoluteUrl(`/benefit/${b.slug}`),
    sameAs: b.apply_url ?? undefined,
  }
}

/**
 * 가이드 본문의 Article.
 *
 * dateModified가 오래 published_at에 묶여 있었다. 본문을 3,324자에서 14,052자로 늘려도
 * 구글에는 "발행 후 변경 없음"으로 보인다. 발행일을 앞당겨 해결하면 최초 발행일이 거짓이
 * 되므로 guides에 updated_at을 따로 두고, 여기서 떨어뜨린다.
 *
 * updated_at이 null이면 발행 후 손대지 않았다는 뜻이므로 published_at을 쓴다. null을
 * "모름"이 아니라 "변경 없음"으로 읽는 것이 이 컬럼의 약속이다.
 *
 * published_at이 없으면 날짜 자체를 내보내지 않는다. 크롤 시각을 발행일로 쓰게 두는 편이
 * 지어낸 날짜를 주는 것보다 낫다.
 */
export function article(g: {
  title: string
  slug: string
  published_at: string | null
  updated_at: string | null
  publisher: string
}) {
  const url = absoluteUrl(`/guide/${g.slug}`)
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: g.title,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    ...(g.published_at
      ? { datePublished: g.published_at, dateModified: g.updated_at ?? g.published_at }
      : {}),
    author: { '@type': 'Organization', name: g.publisher },
    publisher: { '@type': 'Organization', name: g.publisher },
    inLanguage: 'ko',
  }
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  }
}

export function faqPage(items: { q: string; a: string }[]) {
  if (!items.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
}

export function itemList(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: absoluteUrl(it.path) })),
  }
}

/** <script type="application/ld+json"> 에 넣을 문자열. XSS 방지를 위해 '<'를 이스케이프. */
export function jsonLdString(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c')
}
