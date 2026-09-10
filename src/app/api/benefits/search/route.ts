import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseSearchParams, searchBenefits, cacheKeyFor } from '@/lib/benefits/search'
import { getOrSet, CACHE_KEYS, CACHE_TTL } from '@/lib/redis'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const input = parseSearchParams(new URL(request.url).searchParams)
    const result = await getOrSet(CACHE_KEYS.search(cacheKeyFor(input)), CACHE_TTL.search, () =>
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
