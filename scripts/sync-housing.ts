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
    fetchApplyhome: () => fetchApplyhomeDetails(since, { onPage: (op, p, t) => console.log(`${op} ${p}/${t}`) }),
    fetchUnits: (kind, h, p) => fetchApplyhomeUnits(kind, h, p),
    fetchLh: () => fetchLhNotices({ onPage: (cd, p, t) => console.log(`lh ${cd} p${p} (${t ?? '?'})`) }),
    log: console.log,
  })
  const brief = (r: typeof result.applyhome) => ({ ...r, changedSlugs: r.changedSlugs.length, removedSlugs: r.removedSlugs.length })
  console.log(JSON.stringify({ applyhome: brief(result.applyhome), lh: brief(result.lh) }, null, 2))
  if (result.applyhome.error || result.lh.error) process.exit(1)
  if (result.applyhome.aborted_reason || result.lh.aborted_reason) process.exit(2)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
