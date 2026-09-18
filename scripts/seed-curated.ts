import { createAdminClient } from '../src/lib/supabase/admin'
import { CURATED_BENEFITS, CURATED_SOURCE } from '../data/curated-benefits'

/**
 * 원천 API에 없어 손으로 채운 제도를 DB에 반영한다.
 *
 * gov24 동기화와 건드리는 행이 겹치지 않는다(source가 다르고, markRemoved는 source로
 * 범위를 좁힌다). 그래도 순서를 지켜야 하는 곳이 하나 있다: benefit_conditions는
 * benefit_id가 PK라서 benefits를 먼저 넣고 id를 받아야 한다.
 *
 * synced_at에는 checked_at을 쓴다. now()를 넣으면 실행할 때마다 "방금 확인함"이 되어,
 * 아무도 근거 문서를 읽지 않았는데도 최신으로 보인다.
 */
async function main() {
  const supabase = createAdminClient()

  const rows = CURATED_BENEFITS.map((b) => ({
    source: CURATED_SOURCE,
    source_id: b.source_id,
    slug: b.slug,
    title: b.title,
    summary: b.summary,
    amount_text: b.amount_text,
    target_text: b.target_text,
    criteria_text: b.criteria_text,
    apply_method: b.apply_method,
    apply_url: b.apply_url,
    agency: b.agency,
    contact: b.contact,
    deadline_type: 'always' as const,
    apply_start: null,
    apply_end: null,
    region_code: b.region_code,
    segments: b.segments,
    status: 'open' as const,
    alt_sources: b.evidence,
    source_updated_at: b.source_updated_at,
    synced_at: `${b.checked_at}T00:00:00+09:00`,
  }))

  const { data, error } = await supabase
    .from('benefits')
    .upsert(rows, { onConflict: 'source,source_id' })
    .select('id, slug')
  if (error) throw error
  console.log(`benefits ${data?.length ?? 0}건 upsert`)

  const bySlug = new Map((data ?? []).map((r) => [r.slug, r.id]))
  const conds = CURATED_BENEFITS.map((b) => {
    const id = bySlug.get(b.slug)
    if (!id) throw new Error(`upsert 결과에 ${b.slug}가 없다`)
    return { benefit_id: id, ...b.conditions }
  })
  const { error: cErr } = await supabase.from('benefit_conditions').upsert(conds, { onConflict: 'benefit_id' })
  if (cErr) throw cErr
  console.log(`benefit_conditions ${conds.length}건 upsert`)

  for (const b of CURATED_BENEFITS) console.log(`  /benefit/${b.slug}  (확인일 ${b.checked_at})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
