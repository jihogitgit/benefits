import { NextResponse } from 'next/server'
import { CACHE_TAGS, benefitTag, housingTag, isSlugLike } from '@/lib/cache-tags'
import { revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSupabaseRepo } from '@/lib/sync/supabase-repo'
import { runGov24Sync } from '@/lib/sync/gov24-sync'
import { fetchAll } from '@/lib/api/gov24'
import { createHousingRepo } from '@/lib/sync/housing-repo'
import { runHousingSync } from '@/lib/sync/housing-sync'
import type { HousingSyncResult } from '@/lib/sync/housing-types'
import { fetchApplyhomeDetails, fetchApplyhomeUnits } from '@/lib/api/applyhome'
import { fetchLhNotices } from '@/lib/api/lh'

export const runtime = 'nodejs'
// Vercel Hobby 상한. 플랜 상한을 넘는 값은 배포가 실패한다.
// 초기 적재는 scripts/*.ts로 하고, Cron은 변경분만 upsert하므로 보통 30초 이내. Pro 전환 시 300으로.
export const maxDuration = 60

/**
 * 이 수를 넘는 변경은 한 장씩 비우지 않고 benefits:all로 전부 비운다. 원천이 갱신 시각을 통째로
 * 바꾸는 날(10,947건 전부 변경으로 잡힌 적이 있다)에 만 번의 revalidateTag 호출을 피하기 위해서다.
 * 평소 변경은 하루 0~수십 건이라 이 가지로 오지 않는다.
 */
const PER_SLUG_LIMIT = 100 // route 파일은 정해진 이름만 export할 수 있어 내보내지 않는다. 태그는 한 요청에 모아 보내므로 상한을 보수적으로 둔다

/** 공고 동기화 창(일). scripts/sync-housing.ts와 같은 값. 설계 4절. */
const HOUSING_WINDOW_DAYS = 180
/** 공고 단계의 절대 마감 = 요청 시작 + 이 값(ms). maxDuration 60초에서 여유를 뺀 값. 보조금24 단계가 먼저 돌아 그만큼 공고 몫이 줄어든다. */
const HOUSING_TIME_BUDGET_MS = 50_000

/**
 * 보조금24 → (housing=1이면) 청약홈·LH. Hobby는 cron 2개가 한도라 라우트를 하나로 합쳤다.
 * 두 단계는 서로 독립이다(설계 4절). 공고 단계는 보조금24가 중단(409)되거나 실패(500)해도 돌고,
 * 상태 코드는 보조금24 결과만 따른다. 공고 결과는 언제나 본문의 housing에 싣는다 — 소스별 실패는
 * housing.applyhome.error·housing.lh.error, 단계 전체가 던졌을 때만 housing.error.
 */
export async function GET(request: Request) {
  const startedAt = Date.now()
  // 비어 있으면 `Bearer undefined`가 정답이 되어 누구나 통과한다. 비교보다 먼저 막는다.
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const withHousing = new URL(request.url).searchParams.get('housing') === '1'
  const runHousing = () => (withHousing ? housingStep(startedAt + HOUSING_TIME_BUDGET_MS) : Promise.resolve(null))

  let gov24: Record<string, unknown>
  try {
    const repo = createSupabaseRepo(createAdminClient())
    const result = await runGov24Sync({
      repo,
      fetchList: () => fetchAll('serviceList'),
      fetchConditions: () => fetchAll('supportConditions'),
    })

    if (result.aborted_reason) {
      const housing = await runHousing()
      return NextResponse.json({ gov24: { ...result, changedSlugs: undefined, closedSlugs: undefined, removedSlugs: undefined }, housing }, { status: 409 })
    }

    // 목록·홈은 변경이 없어도 매번 비운다. 카드의 D-day와 "최종 동기화" 시각은 하루가 지나면 틀리고,
    // 목록 페이지는 수십 장이라 비용이 거의 없다. 상세 1만 장은 바뀐 슬러그만 비운다 — benefits:all을
    // 쏘면 그 뒤 크롤러 방문마다 재생성이 일어나 ISR 쓰기 한도를 삼킨다(지금까지 그랬다).
    revalidateTag(CACHE_TAGS.benefitsHome)
    revalidateTag(CACHE_TAGS.benefitsLists)

    const slugs = [...new Set([...result.changedSlugs, ...result.closedSlugs, ...result.removedSlugs])]
    const bad = slugs.filter((s) => !isSlugLike(s))
    if (bad.length) console.error('[cron/sync] 슬러그 모양이 아닌 값은 비우지 않는다:', bad) // 하나 때문에 전체를 500으로 만들지 않는다
    let invalidated: 'none' | 'per-slug' | 'all' = 'none'
    if (isNewYearKst()) {
      // 상세 제목의 연도(kstYear)는 태그를 비워야 바뀐다. TTL이 일주일이라 손으로 하면 잊는다.
      revalidateTag(CACHE_TAGS.benefitsAll)
      invalidated = 'all'
    } else if (slugs.length > PER_SLUG_LIMIT) {
      revalidateTag(CACHE_TAGS.benefitsAll)
      invalidated = 'all'
    } else if (slugs.length > bad.length) {
      for (const s of slugs) if (isSlugLike(s)) revalidateTag(benefitTag(s))
      invalidated = 'per-slug'
    }

    gov24 = {
      ...result,
      changedSlugs: result.changedSlugs.length,
      closedSlugs: result.closedSlugs.length,
      removedSlugs: result.removedSlugs.length,
      invalidated,
    }
  } catch (err) {
    console.error('[cron/sync] gov24 failed:', err)
    // 중간에 실패하면 이미 upsert된 행이 있어도 어떤 슬러그인지 모른다. 다음 실행은 그 행을 '변경 없음'으로
    // 건너뛰므로 영영 비워지지 않고, TTL은 일주일이다. 실패는 드무니 이때만 전부 비운다.
    revalidateTag(CACHE_TAGS.benefitsHome)
    revalidateTag(CACHE_TAGS.benefitsLists)
    revalidateTag(CACHE_TAGS.benefitsAll)
    // 내부 메시지(DB·외부 API)는 로그에만 남긴다. 공고 단계는 housingStep이 던지지 않으므로 그대로 돌린다.
    const housing = await runHousing()
    return NextResponse.json({ error: 'sync failed', invalidated: 'all', housing }, { status: 500 })
  }

  const housing = await runHousing()
  return NextResponse.json({ gov24, housing })
}

/** 공고 동기화 + 캐시 무효화. 실패해도 던지지 않는다. */
async function housingStep(deadlineMs: number): Promise<Record<string, unknown>> {
  try {
    const since = new Date(Date.now() - HOUSING_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
    const result: HousingSyncResult = await runHousingSync({
      repo: createHousingRepo(createAdminClient()),
      fetchApplyhome: (opts) => fetchApplyhomeDetails(since, opts),
      fetchUnits: (kind, h, p, opts) => fetchApplyhomeUnits(kind, h, p, opts),
      fetchLh: (opts) => fetchLhNotices(opts),
      since,
      deadlineMs,
    })
    // 목록·홈/my 블록은 매번. 상세는 바뀐 슬러그만(removed 포함 — 내려간 공고 페이지도 갱신돼야 한다).
    revalidateTag(CACHE_TAGS.housingLists)
    const slugs = [...new Set([...result.applyhome.changedSlugs, ...result.applyhome.removedSlugs, ...result.lh.changedSlugs, ...result.lh.removedSlugs])].filter(isSlugLike)
    let invalidated: 'none' | 'per-slug' | 'all' = 'none'
    if (result.applyhome.error || result.lh.error || slugs.length > PER_SLUG_LIMIT) {
      // 소스 하나가 중간에 실패하면 어떤 행이 반영됐는지 모른다(gov24와 같은 이유).
      revalidateTag(CACHE_TAGS.housingAll)
      invalidated = 'all'
    } else if (slugs.length) {
      for (const s of slugs) revalidateTag(housingTag(s))
      invalidated = 'per-slug'
    }
    const brief = (r: HousingSyncResult['applyhome']) => ({ ...r, changedSlugs: r.changedSlugs.length, removedSlugs: r.removedSlugs.length })
    return { applyhome: brief(result.applyhome), lh: brief(result.lh), invalidated }
  } catch (err) {
    console.error('[cron/sync] housing failed:', err)
    revalidateTag(CACHE_TAGS.housingLists)
    revalidateTag(CACHE_TAGS.housingAll)
    return { error: 'housing sync failed', invalidated: 'all' }
  }
}

/** KST 1월 1일인가. cron은 하루 두 번 돌아 둘 다 이 가지를 타지만 비용은 전부 비우기 두 번뿐이다. */
function isNewYearKst(now = new Date()): boolean {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000)
  return kst.getUTCMonth() === 0 && kst.getUTCDate() === 1
}
