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
