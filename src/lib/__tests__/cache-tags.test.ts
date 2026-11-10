import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ALL_CACHE_TAGS, isCacheTag, CACHE_TAGS, benefitTag } from '../cache-tags'

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) return e === '__tests__' ? [] : tsFiles(p)
    return p.endsWith('.ts') || p.endsWith('.tsx') ? [p] : []
  })
}

describe('cache-tags', () => {
  it('isCacheTag는 실제 태그만 통과시킨다', () => {
    for (const t of ALL_CACHE_TAGS) expect(isCacheTag(t)).toBe(true)
    // 예전에 실제로 보냈다가 조용히 성공했던 값들
    for (const t of ['benefits', 'benefit-articles', 'sitemap', '', 'BENEFITS:ALL']) expect(isCacheTag(t)).toBe(false)
  })

  it('benefit:{slug} 태그는 해시라 헤더에 실을 수 있는 ASCII만 남는다', () => {
    const t = benefitTag('청년월세-지원')
    // x-next-cache-tags 헤더에 들어간다. 한글이 섞이면 Node가 ERR_INVALID_CHAR로 거부해 페이지가 500이 된다.
    expect(t).toMatch(/^benefit:[0-9a-f]{16}$/)
    expect(isCacheTag(t)).toBe(true)
    // 같은 슬러그는 같은 태그, 다른 슬러그는 다른 태그(캐시를 다는 쪽과 비우는 쪽이 같은 함수를 쓴다)
    expect(benefitTag('청년월세-지원')).toBe(t)
    expect(benefitTag('청년월세-지원-2')).not.toBe(t)
  })

  it('슬러그 원형이나 주소를 그대로 넣은 태그는 받지 않는다', () => {
    // 캐시에 달린 적이 없는 태그라 revalidateTag가 조용히 성공만 한다
    for (const t of ['benefit:', 'benefit:청년월세-지원', 'benefit:a/b', 'benefit:a b', 'benefit:a%20b', 'benefit:https://naemok.com', 'benefit:0123456789abcdef0']) expect(isCacheTag(t)).toBe(false)
    expect(() => benefitTag('')).toThrow()
    expect(() => benefitTag('a/b')).toThrow()
    expect(() => benefitTag('https://naemok.com/benefit/x')).toThrow()
  })

  it('값이 바뀌면 배포된 캐시를 무효화할 수 없게 되므로 고정한다', () => {
    expect(CACHE_TAGS).toEqual({
      benefitsAll: 'benefits:all',
      benefitsLists: 'benefits:lists',
      benefitsHome: 'benefits:home',
      guides: 'guides',
      regions: 'regions',
    })
  })

  /**
   * unstable_cache의 옵션 타입은 tags?: string[]이라 캐시를 '다는' 쪽은 타입으로 막을 수 없다.
   * 목록에 없는 태그를 단 캐시가 생기면 /api/revalidate가 그 태그를 400으로 거절하므로,
   * 그 캐시는 발행 절차로 영영 비울 수 없게 된다. 정적으로 훑어서 그런 태그를 막는다.
   */
  it('src 안의 모든 unstable_cache 태그는 cache-tags에 등록돼 있다', () => {
    const found = new Map<string, string>()
    for (const f of tsFiles('src')) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/tags:\s*\[([^\]]*)\]/g)) {
        for (const lit of m[1].matchAll(/'([^']+)'/g)) found.set(lit[1], f)
      }
    }
    const unknown = [...found].filter(([t]) => !isCacheTag(t))
    expect(unknown, `등록되지 않은 태그: ${unknown.map(([t, f]) => `${t} (${f})`).join(', ')}`).toEqual([])
    // 훑기 자체가 망가지면 조용히 통과하므로, 상수로 치환된 뒤에도 뭔가는 잡히는지 확인한다
    expect(found.size + [...tsFiles('src')].filter((f) => readFileSync(f, 'utf8').includes('CACHE_TAGS.')).length).toBeGreaterThan(0)
  })
})
