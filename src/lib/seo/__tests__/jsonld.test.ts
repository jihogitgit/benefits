import { describe, it, expect, beforeEach } from 'vitest'
import { article, governmentService, breadcrumbs, faqPage, itemList, jsonLdString } from '../jsonld'

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

  it('jsonLdString은 </script 이스케이프로 태그 탈출을 막는다', () => {
    const out = jsonLdString({ name: '</script><img src=x onerror=alert(1)>' })
    expect(out).not.toContain('</script')
    expect(out).toContain('\\u003c/script')
    expect(JSON.parse(out).name).toBe('</script><img src=x onerror=alert(1)>')
  })
})

describe('article', () => {
  const base = { title: '청년월세 지원', slug: '청년월세', publisher: '내몫' }

  it('증보한 적 없으면 dateModified가 발행일이다', () => {
    const a = article({ ...base, published_at: '2026-09-16T00:00:00Z', updated_at: null })
    expect(a.datePublished).toBe('2026-09-16T00:00:00Z')
    expect(a.dateModified).toBe('2026-09-16T00:00:00Z')
  })

  it('증보했으면 dateModified만 움직이고 발행일은 그대로다', () => {
    const a = article({ ...base, published_at: '2026-09-16T00:00:00Z', updated_at: '2026-09-18T00:00:00Z' })
    expect(a.datePublished).toBe('2026-09-16T00:00:00Z')
    expect(a.dateModified).toBe('2026-09-18T00:00:00Z')
  })

  it('발행일이 없으면 날짜를 아예 내보내지 않는다 — 지어낸 날짜보다 없는 편이 낫다', () => {
    const a = article({ ...base, published_at: null, updated_at: '2026-09-18T00:00:00Z' })
    expect('datePublished' in a).toBe(false)
    expect('dateModified' in a).toBe(false)
  })

  it('한글 슬러그는 URL로 인코딩된다', () => {
    const a = article({ ...base, published_at: null, updated_at: null })
    expect(a.url).toContain('%')
    expect(/[가-힣]/.test(a.url)).toBe(false)
  })
})
