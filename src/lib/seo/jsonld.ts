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
