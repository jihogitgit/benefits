import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ALL_CACHE_TAGS, isCacheTag, CACHE_TAGS } from '../cache-tags'

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

  it('값이 바뀌면 배포된 캐시를 무효화할 수 없게 되므로 고정한다', () => {
    expect(CACHE_TAGS).toEqual({
      benefitsAll: 'benefits:all',
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
