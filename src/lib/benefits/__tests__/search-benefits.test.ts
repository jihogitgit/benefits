import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { searchBenefits, type SearchInput } from '../search'

/**
 * searchBenefits는 Supabase 빌더에 어떤 필터를 얹느냐가 일의 전부라, 빌더 호출을 기록하지 않으면
 * 필터가 통째로 사라져도 아무 테스트가 깨지지 않는다(뮤테이션으로 확인됨).
 * 그래서 진짜 DB 대신 호출을 받아 적는 가짜 빌더를 쓴다. 필터의 '의미'는 DB가 판정하므로
 * 여기서 흉내내지 않는다 — 주어진 행을 그대로 돌려주고, 필터 문자열 자체를 단언한다.
 * 필터가 실제로 같은 결과를 내는지는 scripts/verify-search-parity.ts가 운영 DB로 확인한다.
 */
interface Calls {
  baseOr: string[]
  conditionOr: string[]
  in: [string, readonly unknown[]][]
  selects: string[]
  /** head:true가 아닌(=행을 실제로 가져오는) 조회 수 */
  rowFetches: number
}

const COND = { age_min: null, age_max: null, gender: 'any', life_stages: [], household_types: [], occupations: [], region_codes: [] }
const row = (slug: string, title: string, agency: string | null = null, cond: unknown = COND) => ({
  slug, title, summary: null, amount_text: null, deadline_type: 'always',
  apply_end: null, region_code: 'ALL', segments: [], agency, benefit_conditions: cond,
})

function fakeSupabase(rows: ReturnType<typeof row>[]) {
  const calls: Calls = { baseOr: [], conditionOr: [], in: [], selects: [], rowFetches: 0 }

  function builder(select: string, head: boolean) {
    let orphanQuery = false
    let slugFilter: readonly unknown[] | null = null
    const self = {
      eq: () => self,
      in: (col: string, vals: readonly unknown[]) => {
        calls.in.push([col, vals])
        if (col === 'slug') slugFilter = vals
        return self
      },
      or: (f: string, o?: { referencedTable?: string }) => {
        ;(o?.referencedTable ? calls.conditionOr : calls.baseOr).push(f)
        return self
      },
      is: () => {
        orphanQuery = true
        return self
      },
      order: () => self,
      range: () => self,
      then: (resolve: (v: { data: unknown[] | null; count: number | null; error: null }) => unknown) => {
        // 조건 행이 없는 지원금은 이 테스트 데이터에 없다 — 0건으로 답한다.
        if (orphanQuery) return Promise.resolve({ data: [], count: 0, error: null }).then(resolve)
        if (head) return Promise.resolve({ data: null, count: rows.length, error: null }).then(resolve)
        calls.rowFetches += 1
        const picked = slugFilter ? rows.filter((r) => (slugFilter as unknown[]).includes(r.slug)) : rows
        return Promise.resolve({ data: picked, count: null, error: null }).then(resolve)
      },
    }
    return self
  }

  const client = {
    from: () => ({
      select: (select: string, options?: { head?: boolean }) => {
        calls.selects.push(select)
        return builder(select, options?.head === true)
      },
    }),
  } as unknown as SupabaseClient

  return { client, calls }
}

const input = (over: Partial<SearchInput> = {}): SearchInput => ({
  q: '', ageBand: null, situations: [], region: null, countOnly: false, limit: 50, offset: 0, ...over,
})

describe('searchBenefits — 검색어 필터', () => {
  it('토큰마다 or()를 한 번씩 걸고, 제목·기관·요약 세 필드를 모두 본다', async () => {
    const { client, calls } = fakeSupabase([])
    await searchBenefits(client, input({ q: '청년 월세', countOnly: true }))

    // 토큰당 or() 한 번. PostgREST가 반복된 or= 파라미터를 AND로 묶는 데 기대고 있으므로,
    // 누군가 단일 or()로 '정리'하면 필터가 조용히 OR가 된다. 그 회귀를 여기서 잡는다.
    const uniq = [...new Set(calls.baseOr)]
    expect(uniq).toEqual([
      'title.ilike.%청년%,agency.ilike.%청년%,summary.ilike.%청년%',
      'title.ilike.%월세%,agency.ilike.%월세%,summary.ilike.%월세%',
    ])
  })

  it('검색어가 없으면 or()를 아예 걸지 않는다', async () => {
    const { client, calls } = fakeSupabase([])
    await searchBenefits(client, input({ ageBand: '30s', countOnly: true }))
    expect(calls.baseOr).toEqual([])
  })

  it('토큰 상한을 넘는 검색어는 잘라서 건다', async () => {
    const { client, calls } = fakeSupabase([])
    await searchBenefits(client, input({ q: '가 나 다 라 마 바', countOnly: true }))
    expect([...new Set(calls.baseOr)]).toHaveLength(4)
  })

  it('정규화되지 않은 검색어가 들어와도 or 필터에 기호가 새지 않는다', async () => {
    const { client, calls } = fakeSupabase([])
    await searchBenefits(client, input({ q: '월세,title.ilike.*,x)', countOnly: true }))
    for (const f of calls.baseOr) {
      const tokens = f.split(',').map((part) => part.split('.ilike.')[1])
      for (const t of tokens) expect(t).toMatch(/^%[\p{L}\p{N}]+%$/u)
    }
  })

  it('지역은 본표 필터와 조건표 필터 양쪽에 걸린다', async () => {
    const { client, calls } = fakeSupabase([])
    await searchBenefits(client, input({ region: 'seoul', countOnly: true }))
    expect(calls.in).toContainEqual(['region_code', ['seoul', 'ALL']])
    expect(calls.conditionOr).toContain('region_codes.eq.{},region_codes.cs.{seoul}')
  })

  it('나이·상황 조건은 조건표 필터로 내려간다 (JS 재판정 없음)', async () => {
    const { client, calls } = fakeSupabase([])
    await searchBenefits(client, input({ ageBand: '30s', situations: ['job_seeker'], countOnly: true }))
    const uniq = [...new Set(calls.conditionOr)]
    expect(uniq).toContain(
      'and(age_min.is.null,age_max.is.null),and(or(age_max.is.null,age_max.gte.30),or(age_min.is.null,age_min.lte.39))',
    )
    expect(uniq).toContain('and(life_stages.eq.{},household_types.eq.{},occupations.eq.{}),occupations.ov.{job_seeker}')
  })
})

describe('searchBenefits — 개수 조회', () => {
  it('countOnly는 행을 한 건도 가져오지 않는다', async () => {
    // 홈 CTA가 쓰는 경로다. 예전에는 여기서 전체 테이블을 끌어와 프로덕션 12~14초였다.
    const { client, calls } = fakeSupabase([row('a', '청년 지원'), row('b', '청년 대출')])
    const { total, items } = await searchBenefits(client, input({ q: '청년', countOnly: true }))
    expect(total).toBe(2)
    expect(items).toEqual([])
    expect(calls.rowFetches).toBe(0)
    expect(calls.selects.every((s) => !s.includes('summary'))).toBe(true)
  })

  it('조건 행이 있는 수와 없는 수를 합쳐 총건수를 낸다', async () => {
    const { client } = fakeSupabase([row('a', 'x'), row('b', 'y'), row('c', 'z')])
    const { total } = await searchBenefits(client, input({ countOnly: true }))
    expect(total).toBe(3) // 조건 있음 3 + 조건 없음 0
  })
})

describe('searchBenefits — 제목 가점과 페이지', () => {
  it('제목에 검색어가 있는 항목의 score가 실제로 올라간다', async () => {
    const { client } = fakeSupabase([row('a', '청년 월세 지원'), row('b', '다른 지원', '청년재단')])
    const { items } = await searchBenefits(client, input({ q: '청년' }))
    expect(items.map((i) => i.slug)).toEqual(['a', 'b'])
    expect(items[0].score).toBe(2)
    expect(items[1].score).toBe(0)
  })

  it('검색어가 없으면 가점이 붙지 않아 기존 순위가 그대로다', async () => {
    const { client } = fakeSupabase([row('a', '청년 월세 지원'), row('b', '다른 지원')])
    const { items } = await searchBenefits(client, input())
    expect(items.every((i) => i.score === 0)).toBe(true)
  })

  it('가점이 조건 일치 점수와 합산된다', async () => {
    const seoul = row('a', '청년 월세 지원', null, { ...COND, region_codes: ['seoul'] })
    const { client } = fakeSupabase([seoul])
    const { items } = await searchBenefits(client, input({ q: '청년', region: 'seoul' }))
    expect(items[0].score).toBe(3) // 지역 1 + 제목 2
  })

  it('전체 컬럼은 화면에 나갈 페이지 분량만 가져온다', async () => {
    const rows = ['a', 'b', 'c'].map((s) => row(s, `청년 ${s}`))
    const { client, calls } = fakeSupabase(rows)
    const { total, items } = await searchBenefits(client, input({ q: '청년', offset: 1, limit: 1 }))
    expect(total).toBe(3)
    expect(items.map((i) => i.slug)).toEqual(['b'])
    // 전체 컬럼 조회는 그 한 건만 slug로 집어온다
    expect(calls.in).toContainEqual(['slug', ['b']])
  })

  it('제목 가점이 정렬에 반영된다 (점수를 매긴 뒤에 더하면 순위가 안 바뀐다)', async () => {
    // 랭킹용 조회에서 title을 빼면 가점을 정렬 뒤에 더하게 되어, 점수는 높은데 순서는
    // 그대로인 상태가 된다. 총건수는 맞아서 눈에 띄지 않는다 — 실제로 한 번 냈던 회귀다.
    const seoulNoTitle = row('b', '전혀 다른 지원', null, { ...COND, region_codes: ['seoul'] })
    const titleMatch = row('a', '청년 월세 지원')
    const { client } = fakeSupabase([seoulNoTitle, titleMatch])
    const { items } = await searchBenefits(client, input({ q: '청년', region: 'seoul' }))

    expect(items.map((i) => [i.slug, i.score])).toEqual([
      ['a', 2], // 제목 일치 2
      ['b', 1], // 지역 일치 1
    ])
  })
})
