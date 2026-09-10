import { describe, it, expect, beforeEach } from 'vitest'
import { governmentService, breadcrumbs, faqPage, itemList } from '../jsonld'

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
})

describe('jsonld', () => {
  it('GovernmentService', () => {
    const j = governmentService({ title: '서울 임산부 교통비', summary: '70만원', agency: '서울특별시', region_name: '서울', apply_url: 'https://gov.kr/x', slug: 'a' })
    expect(j['@type']).toBe('GovernmentService')
    expect(j.name).toBe('서울 임산부 교통비')
    expect(j.provider).toEqual({ '@type': 'GovernmentOrganization', name: '서울특별시' })
    expect(j.areaServed).toBe('서울')
    expect(j.url).toBe('https://example.com/benefit/a')
    expect(j.sameAs).toBe('https://gov.kr/x')
  })
  it('BreadcrumbList 위치는 1부터', () => {
    const j = breadcrumbs([{ name: '홈', path: '/' }, { name: '청년', path: '/youth' }])
    expect(j.itemListElement[1]).toEqual({ '@type': 'ListItem', position: 2, name: '청년', item: 'https://example.com/youth' })
  })
  it('FAQPage는 항목이 없으면 null', () => {
    expect(faqPage([])).toBeNull()
    expect(faqPage([{ q: 'Q', a: 'A' }])!.mainEntity[0].acceptedAnswer.text).toBe('A')
  })
  it('ItemList', () => {
    const j = itemList([{ name: 'a', path: '/benefit/a' }])
    expect(j.itemListElement[0].url).toBe('https://example.com/benefit/a')
  })
})
