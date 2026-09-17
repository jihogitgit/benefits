import { NextResponse } from 'next/server'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSupabaseRepo } from '@/lib/sync/supabase-repo'
import { runGov24Sync } from '@/lib/sync/gov24-sync'
import { fetchAll } from '@/lib/api/gov24'

export const runtime = 'nodejs'
// Vercel Hobby 상한. 플랜 상한을 넘는 값은 배포가 실패한다.
// 초기 적재는 scripts/sync-gov24.ts로 하고, Cron은 변경분만 upsert하므로 보통 30초 이내. Pro 전환 시 300으로.
export const maxDuration = 60

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const repo = createSupabaseRepo(createAdminClient())
    const result = await runGov24Sync({
      repo,
      fetchList: () => fetchAll('serviceList'),
      fetchConditions: () => fetchAll('supportConditions'),
    })

    if (result.aborted_reason) {
      return NextResponse.json({ ...result, changedSlugs: undefined }, { status: 409 })
    }

    // benefit:{slug}·segment:{seg} 루프는 두지 않는다. unstable_cache의 태그는 함수 단위라 그런 태그를
    // 가진 캐시 항목이 하나도 없어 아무것도 무효화하지 못하면서, 원문 갱신 시각이 통째로 바뀌는 동기화
    // (10,947건 전부 변경으로 잡힌 적이 있다)에서는 만 번 넘는 호출이 되어 maxDuration 60초를 위협한다.
    // 조회 함수는 모두 benefits:all 또는 benefits:home 태그를 달고 있으므로 이 두 개면 전부 덮는다.
    if (result.changed > 0 || result.closed > 0 || result.removed > 0) {
      revalidateTag(CACHE_TAGS.benefitsHome)
      revalidateTag(CACHE_TAGS.benefitsAll) // unstable_cache 조회 함수(상세·목록·집계)
    }

    return NextResponse.json({ ...result, changedSlugs: result.changedSlugs.length })
  } catch (err) {
    console.error('[cron/sync-gov24] failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
