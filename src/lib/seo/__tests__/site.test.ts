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
  it('사이트명은 env, 없으면 기본값', () => {
    expect(siteName()).toBe('테스트포털')
    delete process.env.SITE_NAME
    expect(siteName()).toBe('지원금 포털')
  })
})
