import { createAdminClient } from '../src/lib/supabase/admin'
import { REGIONS } from '../data/regions'
import { SEGMENTS } from '../data/segments'

async function main() {
  const supabase = createAdminClient()

  const { error: segErr } = await supabase
    .from('segments')
    .upsert(SEGMENTS.map(({ slug, name, sort_order, description_md }) => ({ slug, name, sort_order, description_md })), { onConflict: 'slug' })
  if (segErr) throw segErr
  console.log(`segments ${SEGMENTS.length}건 upsert`)

  const { error: regErr } = await supabase
    .from('regions')
    .upsert(REGIONS.map(({ code, slug, name }) => ({ code, slug, name })), { onConflict: 'code' })
  if (regErr) throw regErr
  console.log(`regions ${REGIONS.length}건 upsert`)
}

main().catch((e) => { console.error(e); process.exit(1) })
