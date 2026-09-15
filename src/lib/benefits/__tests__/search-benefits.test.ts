import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { searchBenefits, type SearchInput } from '../search'

/**
 * searchBenefits는 Supabase 빌더에 필터를 얹는 것이 일의 전부라, 빌더 호출을 기록하지 않으면
 * 검색어 필터가 통째로 사라져도 아무 테스트가 깨지지 않는다(뮤테이션으로 확인됨).
 * 그래서 진짜 DB 대신 호출만 받아 적는 가짜 빌더를 쓴다.
 */
function fakeSupabase(rows: unknown[]) {
  const calls = { or: [] as string[], in: [] as [string, unknown[]][], range: [] as [number, number][] }
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    range: (a: number, b: number) => {
      calls.range.push([a, b])
      return builder
    },
    in: (col: string, vals: unknown[]) => {
      calls.in.push([col, vals])
      return builder
    },
    or: (filter: string) => {
      calls.or.push(filter)
      return builder
    },
    // await query가 동작하도록 thenable로 만든다
    then: (resolve: (v: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
  }
  return { client: { from: () => builder } as unknown as SupabaseClient, calls }
}

const COND = { age_min: null, age_max: null, gender: 'any', life_stages: [], household_types: [], occupations: [], region_codes: [] }
const row = (slug: string, title: string, agency: string | null = null) => ({
  slug, title, summary: null, amount_text: null, deadline_type: 'always',
  apply_end: null, region_code: 'ALL', segments: [], agency, benefit_conditions: COND,
})

const input = (over: Partial<SearchInput> = {}): SearchInput => ({
  q: '', ageBand: null, situations: [], region: null, countOnly: false, limit: 50, offset: 0, ...over,
})

describe('searchBenefits — 검색어 필터', () => {
  it('토큰마다 or()를 한 번씩 걸고, 제목·기관·요약 세 필드를 모두 본다', async () => {
    const { client, calls } = fakeSupabase([])
    await searchBenefits(client, input({ q: '청년 월세' }))

    // 토큰당 or() 한 번. PostgREST가 반복된 or= 파라미터를 AND로 묶는 데 기대고 있으므로,
    // 누군가 단일 or()로 '정리'하면 필터가 조용히 OR가 된다. 그 회귀를 여기서 잡는다.
    expect(calls.or).toHaveLength(2)
    expect(calls.or[0]).toBe('title.ilike.%청년%,agency.ilike.%청년%,summary.ilike.%청년%')
    expect(calls.or[1]).toBe('title.ilike.%월세%,agency.ilike.%월세%,summary.ilike.%월세%')
  })

  it('검색어가 없으면 or()를 아예 걸지 않는다', async () => {
    const { client, calls } = fakeSupabase([])
    await searchBenefits(client, input({ ageBand: '30s' }))
    expect(calls.or).toHaveLength(0)
  })

  it('토큰 상한을 넘는 검색어는 잘라서 건다', async () => {
    const { client, calls } = fakeSupabase([])
    await searchBenefits(client, input({ q: '가 나 다 라 마 바' }))
    expect(calls.or).toHaveLength(4)
  })

  it('정규화되지 않은 검색어가 들어와도 or 필터에 기호가 새지 않는다', async () => {
    const { client, calls } = fakeSupabase([])
    await searchBenefits(client, input({ q: '월세,title.ilike.*,x)' }))
    for (const f of calls.or) {
      // 토큰 자리에 PostgREST 문법 문자가 들어가면 필터 구조 자체가 바뀐다
      const tokens = f.split(',').map((part) => part.split('.ilike.')[1])
      for (const t of tokens) expect(t).toMatch(/^%[\p{L}\p{N}]+%$/u)
    }
  })

  it('지역 필터는 검색어와 함께 걸린다', async () => {
    const { client, calls } = fakeSupabase([])
    await searchBenefits(client, input({ q: '월세', region: 'seoul' }))
    expect(calls.in).toEqual([['region_code', ['seoul', 'ALL']]])
    expect(calls.or).toHaveLength(1)
  })
})

describe('searchBenefits — 제목 가점', () => {
  it('제목에 검색어가 있는 항목의 score가 실제로 올라간다', async () => {
    const { client } = fakeSupabase([row('a', '청년 월세 지원'), row('b', '다른 지원', '청년재단')])
    const { items } = await searchBenefits(client, input({ q: '청년' }))

    expect(items.map((i) => i.slug)).toEqual(['a', 'b'])
    expect(items[0].score).toBe(2) // 제목 일치 가점
    expect(items[1].score).toBe(0) // 기관명만 걸림
  })

  it('검색어가 없으면 가점이 붙지 않아 기존 순위가 그대로다', async () => {
    const { client } = fakeSupabase([row('a', '청년 월세 지원'), row('b', '다른 지원')])
    const { items } = await searchBenefits(client, input())
    expect(items.every((i) => i.score === 0)).toBe(true)
  })

  it('가점이 조건 일치 점수와 합산된다', async () => {
    const seoul = { ...row('a', '청년 월세 지원'), benefit_conditions: { ...COND, region_codes: ['seoul'] } }
    const { client } = fakeSupabase([seoul])
    const { items } = await searchBenefits(client, input({ q: '청년', region: 'seoul' }))
    expect(items[0].score).toBe(3) // 지역 1 + 제목 2
  })
})

describe('searchBenefits — 페이지네이션', () => {
  it('countOnly는 total만 주고 items는 비운다', async () => {
    const { client } = fakeSupabase([row('a', '청년 지원'), row('b', '청년 대출')])
    const { total, items } = await searchBenefits(client, input({ q: '청년', countOnly: true }))
    expect(total).toBe(2)
    expect(items).toEqual([])
  })

  it('offset·limit이 순위 매긴 결과에 적용된다', async () => {
    const { client } = fakeSupabase([row('a', '청년 A'), row('b', '청년 B'), row('c', '청년 C')])
    const { total, items } = await searchBenefits(client, input({ q: '청년', offset: 1, limit: 1 }))
    expect(total).toBe(3)
    expect(items.map((i) => i.slug)).toEqual(['b'])
  })
})
