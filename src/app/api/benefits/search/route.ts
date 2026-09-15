import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseSearchParams, searchBenefits, cacheKeyFor } from '@/lib/benefits/search'
import { getOrSet, CACHE_KEYS, CACHE_TTL } from '@/lib/redis'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/** 1분당 허용 요청 수. 300ms 디바운스로 사람이 치면 분당 수 건이라 넉넉하고, 자동 반복은 막힌다. */
const RATE_LIMIT = 60
const RATE_WINDOW_SEC = 60

/** 레이트 리밋 기준 클라이언트. Vercel이 앞단이라 x-forwarded-for 첫 항목이 실제 IP다. */
function clientKey(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

export async function GET(request: Request) {
  try {
    if (!(await rateLimit(`search:${clientKey(request)}`, RATE_LIMIT, RATE_WINDOW_SEC))) {
      return NextResponse.json({ error: 'too many requests' }, { status: 429, headers: { 'retry-after': String(RATE_WINDOW_SEC) } })
    }
    const input = parseSearchParams(new URL(request.url).searchParams)
    const ttl = input.q ? CACHE_TTL.searchKeyword : CACHE_TTL.search
    const result = await getOrSet(CACHE_KEYS.search(cacheKeyFor(input)), ttl, () =>
      searchBenefits(createAdminClient(), input),
    )
    return NextResponse.json(result, {
      headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (err) {
    console.error('[api/benefits/search] failed:', err)
    return NextResponse.json({ error: 'search failed' }, { status: 500 })
  }
}
