import { createAdminClient } from '../src/lib/supabase/admin'
import { createSupabaseRepo } from '../src/lib/sync/supabase-repo'
import { runGov24Sync } from '../src/lib/sync/gov24-sync'
import { fetchAll } from '../src/lib/api/gov24'

async function main() {
  const repo = createSupabaseRepo(createAdminClient())
  const result = await runGov24Sync({
    repo,
    fetchList: () => fetchAll('serviceList', { onPage: (p, t) => console.log(`serviceList ${p}/${t}`) }),
    fetchConditions: () => fetchAll('supportConditions', { onPage: (p, t) => console.log(`supportConditions ${p}/${t}`) }),
    log: console.log,
  })
  console.log(JSON.stringify({ ...result, changedSlugs: result.changedSlugs.length }, null, 2))
  if (result.aborted_reason) process.exit(2)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
