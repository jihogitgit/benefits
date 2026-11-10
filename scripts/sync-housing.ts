import { createAdminClient } from '../src/lib/supabase/admin'
import { createHousingRepo } from '../src/lib/sync/housing-repo'
import { runHousingSync } from '../src/lib/sync/housing-sync'
import { fetchApplyhomeDetails, fetchApplyhomeUnits } from '../src/lib/api/applyhome'
import { fetchLhNotices } from '../src/lib/api/lh'

/** 설계 4절: 모집공고일 최근 180일. */
export const HOUSING_WINDOW_DAYS = 180

async function main() {
  const repo = createHousingRepo(createAdminClient())
  const since = new Date(Date.now() - HOUSING_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
  const result = await runHousingSync({
    repo,
    fetchApplyhome: (opts) => fetchApplyhomeDetails(since, { ...opts, onPage: (op, p, t) => console.log(`${op} ${p}/${t}`) }),
    fetchUnits: (kind, h, p, opts) => fetchApplyhomeUnits(kind, h, p, opts),
    fetchLh: (opts) => fetchLhNotices({ ...opts, onPage: (cd, p, t) => console.log(`lh ${cd} p${p} (${t ?? '?'})`) }),
    since,
    log: console.log,
  })
  const brief = (r: typeof result.applyhome) => ({ ...r, changedSlugs: r.changedSlugs.length, removedSlugs: r.removedSlugs.length })
  console.log(JSON.stringify({ applyhome: brief(result.applyhome), lh: brief(result.lh) }, null, 2))
  // 스크립트는 Next 밖에서 돌아 revalidateTag를 부를 수 없다. 넣은 행이 페이지에 보이려면 캐시를 따로 비워야 한다.
  if (result.applyhome.upserted + result.lh.upserted > 0) {
    console.log('\n캐시는 비우지 않았다. /api/revalidate에 {"tags":["housing:lists","housing:all"]}를 보내거나 다음 cron을 기다린다.')
  }
  if (result.applyhome.error || result.lh.error) process.exit(1)
  if (result.applyhome.aborted_reason || result.lh.aborted_reason) process.exit(2)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
