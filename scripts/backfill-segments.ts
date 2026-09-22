import { createAdminClient } from '../src/lib/supabase/admin'
import { tagSegments, type SegmentCondInput } from '../src/lib/segments/rules'
import type { Segment } from '../src/types/database'

/**
 * 이미 들어와 있는 행의 segments를 지금 규칙으로 다시 계산한다.
 *
 * 규칙(lib/segments/rules.ts)을 고쳐도 기존 행은 그대로 남는다. 동기화가 원천 수정일시로
 * 변경을 판단하기 때문이다(sync/diff.ts의 isChanged) — 규칙만 바뀌고 원천이 그대로면
 * 그 행은 건너뛴다. 그래서 규칙을 고친 뒤에는 이 스크립트를 한 번 돌려야 하고, 돌리지
 * 않으면 고친 규칙이 새로 들어오는 행에만 적용되어 두 기준이 DB에 섞인다.
 *
 * 원천 API를 부르지 않는다. 판정에 쓰는 세 필드(제목·지원대상·목적요약)와 조건 코드가
 * 이미 DB에 있으므로, 다시 받아올 이유가 없고 쿼터를 쓸 이유도 없다.
 *
 * synced_at을 건드리지 않는다. 여기서 now()를 넣으면 아무도 원천을 확인하지 않았는데도
 * 전 건이 "방금 확인함"이 된다(seed-curated.ts와 같은 판단).
 *
 * 기본은 시늉만 한다. 1만 건을 건드리는 스크립트라 --apply 없이는 쓰지 않는다.
 *
 * 한 건씩 UPDATE하고 첫 실패에서 멈춘다. 그래도 **다시 돌리면 이어서 진행된다** — 재계산이
 * 결정적이고 집합 비교로 변경분만 쓰므로, 이미 쓴 행은 두 번째 실행에서 목록에 들지 않는다.
 *
 * 사용:
 *   npx tsx --env-file=.env.local scripts/backfill-segments.ts
 *   npx tsx --env-file=.env.local scripts/backfill-segments.ts --apply
 */

const PAGE = 1000
const EMPTY: SegmentCondInput = { age_min: null, age_max: null, life_stages: [], occupations: [], household_types: [] }

interface Row {
  id: string
  slug: string
  title: string
  target_text: string | null
  summary: string | null
  segments: string[]
  status: string
  // typeof EMPTY로 두면 age_min이 null 전용, life_stages가 never[]로 추론되어 타입이
  // 오류를 잡아 주지 못한다. 판정 함수가 받는 타입을 그대로 쓴다.
  benefit_conditions: SegmentCondInput | null
}

async function main() {
  const apply = process.argv.includes('--apply')
  const supabase = createAdminClient()

  const rows: Row[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('benefits')
      .select('id, slug, title, target_text, summary, segments, status, benefit_conditions(age_min, age_max, life_stages, occupations, household_types)')
      .order('slug', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    const chunk = (data ?? []) as unknown as Row[]
    rows.push(...chunk)
    if (chunk.length < PAGE) break
  }
  console.log(`대상 ${rows.length}건 (open ${rows.filter((r) => r.status === 'open').length}건)`)

  const changed: { row: Row; next: Segment[] }[] = []
  for (const r of rows) {
    const c = r.benefit_conditions ?? EMPTY
    const next = tagSegments(
      { title: r.title, target_text: r.target_text, summary: r.summary },
      {
        age_min: c.age_min,
        age_max: c.age_max,
        life_stages: c.life_stages ?? [],
        occupations: c.occupations ?? [],
        household_types: c.household_types ?? [],
      },
    )
    // 순서까지 비교하면 뜻이 같은데 순서만 다른 행을 매번 쓰게 된다. tagSegments의 순서는
    // 규칙의 판정 순서라 안정적이지만, 비교는 집합으로 한다.
    const before = [...r.segments].sort().join(',')
    if (before !== [...next].sort().join(',')) changed.push({ row: r, next })
  }

  const shapes = new Map<string, number>()
  for (const { row, next } of changed) {
    const key = `${[...row.segments].sort().join('+') || '(없음)'} → ${[...next].sort().join('+')}`
    shapes.set(key, (shapes.get(key) ?? 0) + 1)
  }
  console.log(`\n바뀌는 행 ${changed.length}건 (open ${changed.filter((c) => c.row.status === 'open').length}건)`)
  for (const [k, n] of [...shapes.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}건  ${k}`)

  if (!apply) {
    console.log('\n시늉만 했다. 실제로 쓰려면 --apply')
    return
  }

  let done = 0
  for (const { row, next } of changed) {
    const { error } = await supabase.from('benefits').update({ segments: next }).eq('id', row.id)
    if (error) throw new Error(`${row.slug}: ${error.message}`)
    done++
    if (done % 50 === 0) console.log(`  ${done}/${changed.length}`)
  }
  console.log(`\n${done}건 갱신. 세그먼트·지역 허브와 사이트맵 캐시를 비워야 화면에 반영된다:`)
  console.log('  npx tsx --env-file=.env.local scripts/revalidate.ts --url=https://naemok.com')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
