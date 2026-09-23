import { createAdminClient } from '../src/lib/supabase/admin'
import { groupPeers, type PeerItem } from '../src/lib/benefits/peer-group'
import { compareIndexable } from '../src/lib/seo/index-policy'

/**
 * 비교 페이지 66장에 "금액 말고 무엇을 더 실을 수 있는가"를 잰다.
 *
 * 재는 이유: 비교 페이지의 고유 텍스트는 229~355자뿐이고 대부분이 지자체 이름
 * 나열이다(운영 66장 실측). 실질을 더해야 하는데, 무엇을 더할지는 채움률이 정한다.
 * 안 재고 넣으면 연간 캘린더·제외 조건 때와 같은 자리를 밟는다 — 화면에 칸만 생기고
 * 대부분의 페이지에서 비어 있는 것.
 *
 * 금액(amount_text)은 후보에서 뺀다. 총액·월액·분할이 한 열에 섞여 있어 나란히
 * 놓는 순간 서로 다른 것을 잰 값이 한 축에 선다. 근거는 PeerList.tsx 주석.
 *
 * 판정 기준: 한 축이 쓸모 있으려면 (1) 묶음의 과반이 값을 갖고 (2) 묶음마다 값이
 * 달라야 한다. 66장 전부 같은 문장이 나오면 그건 실질이 아니라 보일러플레이트가
 * 425자에서 늘어난 것일 뿐이다.
 *
 * 읽기만 한다. 쓰지 않는다.
 */

const ROWS_PER_PAGE = 1000

interface Row extends PeerItem {
  id: string
  deadline_type: string
  apply_method: string | null
  apply_end: string | null
}

interface Cond {
  benefit_id: string
  age_min: number | null
  age_max: number | null
  income_bands: string[]
  life_stages: string[]
  household_types: string[]
  occupations: string[]
}

/** 한 묶음에서 그 축에 값이 있는 건수. */
const filled = {
  deadline: (r: Row) => r.deadline_type !== 'unknown',
  apply_method: (r: Row) => !!r.apply_method?.trim(),
  apply_end: (r: Row) => !!r.apply_end,
}

const condAxes = ['income_bands', 'life_stages', 'household_types', 'occupations'] as const
type CondAxis = (typeof condAxes)[number]

function pct(n: number, d: number): string {
  return d === 0 ? '  -  ' : `${((n / d) * 100).toFixed(0).padStart(3)}%`
}

async function main() {
  const db = createAdminClient()

  const rows: Row[] = []
  for (let offset = 0; ; offset += ROWS_PER_PAGE) {
    const { data, error } = await db
      .from('benefits')
      .select('id, slug, title, region_code, agency, deadline_type, apply_method, apply_end')
      .eq('status', 'open')
      .order('slug')
      .range(offset, offset + ROWS_PER_PAGE - 1)
    if (error) throw error
    const page = (data ?? []) as unknown as Row[]
    rows.push(...page)
    if (page.length < ROWS_PER_PAGE) break
  }
  console.log(`open 지원금 ${rows.length}건`)

  // 비교 페이지가 실제로 열리는 묶음만 본다(사이트맵과 같은 기준).
  const groups = [...groupPeers(rows as unknown as PeerItem[])]
    .map(([key, items]) => ({ key, items: items as Row[], regionCount: new Set(items.map((i) => i.region_code)).size }))
    .filter((g) => compareIndexable({ regionCount: g.regionCount }))
  console.log(`색인되는 비교 묶음 ${groups.length}개 / 담긴 지원금 ${groups.reduce((n, g) => n + g.items.length, 0)}건\n`)

  // .in()으로 id를 넘기지 않는다. uuid 900개면 요청 URL이 19KB가 되어 PostgREST가
  // 헤더 한도(16KB)에서 끊는다. 표를 통째로 훑고 메모리에서 거른다.
  const ids = new Set(groups.flatMap((g) => g.items.map((i) => i.id)))
  const conds = new Map<string, Cond>()
  for (let offset = 0; ; offset += ROWS_PER_PAGE) {
    const { data, error } = await db
      .from('benefit_conditions')
      .select('benefit_id, age_min, age_max, income_bands, life_stages, household_types, occupations')
      .order('benefit_id')
      .range(offset, offset + ROWS_PER_PAGE - 1)
    if (error) throw error
    const page = (data ?? []) as unknown as Cond[]
    for (const c of page) if (ids.has(c.benefit_id)) conds.set(c.benefit_id, c)
    if (page.length < ROWS_PER_PAGE) break
  }
  console.log(`조건 행 ${conds.size}/${ids.size}건 확보\n`)

  // ── 축별 요약: 묶음 몇 개에서 과반이 값을 갖는가 ──────────────────────────
  type Axis = { name: string; of: (r: Row) => boolean }
  const axes: Axis[] = [
    { name: 'deadline_type (상시/기한)', of: filled.deadline },
    { name: 'apply_end (마감일)', of: filled.apply_end },
    { name: 'apply_method (신청방법)', of: filled.apply_method },
    ...condAxes.map((a) => ({
      name: `${a}`,
      of: (r: Row) => (conds.get(r.id)?.[a as CondAxis] ?? []).length > 0,
    })),
    { name: 'age_min/max (나이)', of: (r: Row) => conds.get(r.id)?.age_min != null || conds.get(r.id)?.age_max != null },
  ]

  console.log('축별 — 전체 채움률과, 묶음 단위로 과반이 채워진 묶음 수')
  console.log(`${'축'.padEnd(28)} ${'전체'.padStart(6)}  ${'과반 묶음'.padStart(9)}  ${'전무 묶음'.padStart(9)}`)
  for (const ax of axes) {
    let tot = 0
    let hit = 0
    let major = 0
    let none = 0
    for (const g of groups) {
      const n = g.items.filter(ax.of).length
      tot += g.items.length
      hit += n
      if (n * 2 > g.items.length) major++
      if (n === 0) none++
    }
    console.log(
      `${ax.name.padEnd(28)} ${pct(hit, tot)}  ${String(major).padStart(4)}/${groups.length}  ${String(none).padStart(4)}/${groups.length}`,
    )
  }

  // ── 값이 묶음마다 다른가 ────────────────────────────────────────────────
  console.log('\ndeadline_type 묶음별 분포 (상시 / 기한 / 모름)')
  const shapes = new Map<string, number>()
  for (const g of groups) {
    const a = g.items.filter((i) => i.deadline_type === 'always').length
    const p = g.items.filter((i) => i.deadline_type === 'period').length
    const u = g.items.length - a - p
    const shape = a === g.items.length ? '전부 상시' : p === g.items.length ? '전부 기한' : u === g.items.length ? '전부 모름' : '섞임'
    shapes.set(shape, (shapes.get(shape) ?? 0) + 1)
  }
  for (const [k, v] of [...shapes].sort((x, y) => y[1] - x[1])) console.log(`  ${k.padEnd(10)} ${v}묶음`)

  console.log('\n묶음별 표본 (건수 많은 순 12개)')
  console.log(`${'묶음'.padEnd(26)} ${'건'.padStart(3)} ${'상시'.padStart(4)} ${'기한'.padStart(4)} ${'마감일'.padStart(5)} ${'소득'.padStart(4)} ${'가구'.padStart(4)} ${'생애'.padStart(4)} ${'직업'.padStart(4)} ${'나이'.padStart(4)}`)
  for (const g of [...groups].sort((a, b) => b.items.length - a.items.length).slice(0, 12)) {
    const c = (a: CondAxis) => g.items.filter((i) => (conds.get(i.id)?.[a] ?? []).length > 0).length
    const age = g.items.filter((i) => conds.get(i.id)?.age_min != null || conds.get(i.id)?.age_max != null).length
    console.log(
      `${g.key.slice(0, 26).padEnd(26)} ${String(g.items.length).padStart(3)} ` +
        `${String(g.items.filter((i) => i.deadline_type === 'always').length).padStart(4)} ` +
        `${String(g.items.filter((i) => i.deadline_type === 'period').length).padStart(4)} ` +
        `${String(g.items.filter(filled.apply_end).length).padStart(5)} ` +
        `${String(c('income_bands')).padStart(4)} ${String(c('household_types')).padStart(4)} ` +
        `${String(c('life_stages')).padStart(4)} ${String(c('occupations')).padStart(4)} ${String(age).padStart(4)}`,
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

