import { describe, it, expect } from 'vitest'
import { BROWSE_DEFAULTS, browseHref, isDefaultBrowse, parseBrowseParams, regionFilterOf, segmentSlugOf } from '../browse'

describe('/benefits 필터 입력', () => {
  it('허용 목록 밖의 값은 버리고 기본값으로 둔다', () => {
    expect(parseBrowseParams({ seg: 'nope', region: 'mars', status: 'x', sort: 'popular', page: '-3', explained: 'yes' })).toEqual(BROWSE_DEFAULTS)
  })

  it('유효한 값은 그대로 읽는다', () => {
    const i = parseBrowseParams({ seg: 'small-biz', region: 'seoul', status: 'soon', sort: 'recent', explained: '1', q: '  월세  지원 ', page: '3' })
    expect(i).toEqual({ seg: 'small-biz', region: 'seoul', status: 'soon', sort: 'recent', explained: true, q: '월세 지원', page: 3 })
  })

  it('검색어의 문장부호는 지워진다 — ilike 패턴 문자(%, _)가 쿼리에 닿지 않는다', () => {
    expect(parseBrowseParams({ q: '100%_지원' }).q).not.toMatch(/[%_]/)
  })

  it('페이지는 정수만, 상한에서 자른다', () => {
    expect(parseBrowseParams({ page: '2.5' }).page).toBe(1)
    expect(parseBrowseParams({ page: '999999' }).page).toBe(600)
  })

  it('주소는 기본값을 빼고 만든다 — 같은 목록이 두 주소를 갖지 않는다', () => {
    expect(browseHref(BROWSE_DEFAULTS)).toBe('/benefits')
    expect(browseHref(BROWSE_DEFAULTS, { status: 'all', sort: 'deadline', page: 1 })).toBe('/benefits')
    expect(browseHref(BROWSE_DEFAULTS, { seg: 'youth', page: 2 })).toBe('/benefits?seg=youth&page=2')
  })

  it('새로 등록순을 읽는다', () => {
    expect(parseBrowseParams({ sort: 'new' }).sort).toBe('new')
    expect(browseHref(BROWSE_DEFAULTS, { sort: 'new' })).toBe('/benefits?sort=new')
  })

  it('주소 → 입력 → 주소가 왕복한다', () => {
    const href = browseHref(BROWSE_DEFAULTS, { seg: 'parenting', region: 'national', status: 'always', sort: 'recent', explained: true, q: '출산 지원', page: 4 })
    const back = parseBrowseParams(Object.fromEntries(new URLSearchParams(href.split('?')[1])))
    expect(browseHref(back)).toBe(href)
  })

  it('기본 목록만 기본으로 본다(색인 판단)', () => {
    expect(isDefaultBrowse(BROWSE_DEFAULTS)).toBe(true)
    expect(isDefaultBrowse({ ...BROWSE_DEFAULTS, page: 2 })).toBe(false)
    expect(isDefaultBrowse({ ...BROWSE_DEFAULTS, q: '월세' })).toBe(false)
  })

  it('분야 path → 세그먼트, 지역은 region_code에 담긴 slug 그대로', () => {
    expect(segmentSlugOf('small-biz')).toBe('small_biz')
    expect(segmentSlugOf(null)).toBeNull()
    // region_code 열은 행정코드('11')가 아니라 slug를 담는다. 코드로 바꿔 걸면 0건이 된다.
    expect(regionFilterOf('seoul')).toBe('seoul')
    expect(regionFilterOf('national')).toBeNull()
  })
})
