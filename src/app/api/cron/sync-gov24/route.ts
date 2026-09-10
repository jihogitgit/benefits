import { NextResponse } from 'next/server'
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

    for (const slug of result.changedSlugs) revalidateTag(`benefit:${slug}`)
    for (const seg of result.changedSegments) revalidateTag(`segment:${seg}`)
    if (result.changed > 0 || result.closed > 0) revalidateTag('benefits:home')

    return NextResponse.json({ ...result, changedSlugs: result.changedSlugs.length })
  } catch (err) {
    console.error('[cron/sync-gov24] failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
