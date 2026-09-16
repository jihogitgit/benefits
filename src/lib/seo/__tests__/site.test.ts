import { describe, it, expect, beforeEach } from 'vitest'
import { absoluteUrl, siteName, siteUrl } from '../site'

describe('site', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com/'
    process.env.SITE_NAME = '테스트포털'
  })
  it('절대 URL은 슬래시를 중복하지 않는다', () => {
    expect(absoluteUrl('/youth')).toBe('https://example.com/youth')
    expect(absoluteUrl('youth')).toBe('https://example.com/youth')
    expect(siteUrl()).toBe('https://example.com')
  })
  it('빈 문자열 env는 기본값으로 (상대 URL 유출 방지)', () => {
    process.env.NEXT_PUBLIC_SITE_URL = ''
    process.env.SITE_NAME = '   '
    expect(siteUrl()).toBe('http://localhost:3000')
    expect(absoluteUrl('/youth')).toBe('http://localhost:3000/youth')
    expect(siteName()).toBe('내몫')
  })

  it('사이트명은 env, 없으면 기본값', () => {
    expect(siteName()).toBe('테스트포털')
    delete process.env.SITE_NAME
    expect(siteName()).toBe('내몫')
  })
})

describe('absoluteUrl — 경로 인코딩', () => {
  // 사이트맵 <loc>과 페이지 canonical이 같은 문자열이어야 한다. 한글 슬러그를 인코딩하지
  // 않으면 사이트맵만 한글로 나가 같은 문서가 두 주소로 보인다.
  it('한글 슬러그를 퍼센트 인코딩한다', () => {
    expect(absoluteUrl('/guide/출산지원금')).toBe('https://example.com/guide/%EC%B6%9C%EC%82%B0%EC%A7%80%EC%9B%90%EA%B8%88')
  })

  it('경로 구분자는 인코딩하지 않는다', () => {
    expect(absoluteUrl('/youth/seoul')).toBe('https://example.com/youth/seoul')
  })

  it('여러 구간에 한글이 섞여 있어도 구분자를 유지한다', () => {
    expect(absoluteUrl('/청년/서울')).toBe('https://example.com/%EC%B2%AD%EB%85%84/%EC%84%9C%EC%9A%B8')
  })

  it('ASCII 경로는 그대로 둔다', () => {
    expect(absoluteUrl('/terms')).toBe('https://example.com/terms')
    expect(absoluteUrl('/')).toBe('https://example.com/')
  })
})
