import { createAdminClient } from '../src/lib/supabase/admin'

/**
 * 제외 조건·중복수급 문구가 원문에 실제로 얼마나, 어떤 모양으로 있는지 센다.
 *
 * 세는 이유: "제외 조건 블록"과 "중복수급 판정"은 둘 다 원문에서 문구를 뽑아
 * 사용자에게 "당신은 못 받습니다"라고 말하는 기능이다. 발췌가 틀리면 금액을 틀리게
 * 적는 것보다 나쁘다. 만들지 말지를 정하려면 먼저 분포를 알아야 한다.
 *
 * 검색 API로는 셀 수 없다. src/lib/benefits/search.ts의 q는 title·agency·summary만
 * 보고 criteria_text·target_text는 보지 않는다(307행). 그쪽으로 세면 자격 조건이
 * 통째로 빠진 값이 나와 "근거 없음"으로 오판하게 된다.
 *
 * 읽기만 한다. 쓰지 않는다.
 */

/** 네 필드를 다 본다. 어느 필드에 실리는지가 곧 어디서 뽑아야 하는지다. */
const FIELDS = ['title', 'summary', 'amount_text', 'target_text', 'criteria_text'] as const
type Field = (typeof FIELDS)[number]

/** 찾을 문구. 실제 공고 표기를 그대로 넣는다 — 표기가 갈리면 한 덩어리로 세지 않는다. */
const PATTERNS: { key: string; re: RegExp }[] = [
  { key: '중복 불가/제한', re: /중복\s*(수급|지원|신청)?\s*(불가|제한|불허|배제)/ },
  { key: '중복 (일반)', re: /중복/ },
  // 자격에서 빼는 '제외'만 고른다. 넓은 /제외/ 는 '점심시간 12:00~13:00 제외',
  // '일반인에게 분양되는 복리시설은 제외'처럼 자격과 무관한 문장을 그대로 끌고 온다.
  { key: '자격 제외', re: /(대상|자격|신청자|가구|세대|자)\s*(에서|에선|은|는)?\s*제외/ },
  { key: '제외 (넓게)', re: /제외/ },
  { key: '지원 불가', re: /지원\s*(대상\s*)?(제외|불가)/ },
  { key: '타 사업/기관', re: /타\s*(사업|기관|지자체|부처)/ },
  // '보청기 지원'의 '기 지원'에 걸리던 /기\s*(수혜|지원)/ 를 버린다. 89건이 전부 오탐이었다.
  { key: '기수혜/기지원', re: /기수혜|기지원|이미\s*(지원|수혜)\s*받/ },
  { key: '우선 순위', re: /우선\s*(순위|선발|지원)/ },
]

type Row = Record<Field, string | null>

async function main() {
  const db = createAdminClient()

  const { count: total, error: countErr } = await db
    .from('benefits')
    .select('slug', { count: 'exact', head: true })
    .eq('status', 'open')
  if (countErr) throw countErr
  console.log(`대상: status=open ${total}건\n`)

  // 필드별 채움률과 패턴별 출현을 한 번에 센다.
  const filled: Record<Field, number> = { title: 0, summary: 0, amount_text: 0, target_text: 0, criteria_text: 0 }
  const hits: Record<string, Record<Field, number>> = {}
  for (const p of PATTERNS) {
    hits[p.key] = { title: 0, summary: 0, amount_text: 0, target_text: 0, criteria_text: 0 }
  }
  /** 어느 필드에서든 한 번이라도 걸린 행. 기능이 붙을 수 있는 행 수의 상한이다. */
  const anyHit = new Set<string>()
  const samples: { key: string; field: Field; slug: string; text: string }[] = []

  const PAGE = 1000
  let from = 0
  let seen = 0
  for (;;) {
    const { data, error } = await db
      .from('benefits')
      .select('slug, title, summary, amount_text, target_text, criteria_text')
      .eq('status', 'open')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break

    for (const raw of data) {
      const r = raw as Row & { slug: string }
      seen++
      for (const f of FIELDS) if ((r[f] ?? '').trim()) filled[f]++
      for (const p of PATTERNS) {
        for (const f of FIELDS) {
          const v = r[f] ?? ''
          if (!v || !p.re.test(v)) continue
          hits[p.key][f]++
          anyHit.add(r.slug)
          if (samples.filter((s) => s.key === p.key).length < 2) {
            const m = p.re.exec(v)
            const at = m ? Math.max(0, m.index - 30) : 0
            samples.push({ key: p.key, field: f, slug: r.slug, text: v.slice(at, at + 90).replace(/\s+/g, ' ') })
          }
        }
      }
    }
    if (data.length < PAGE) break
    from += PAGE
  }

  const pct = (n: number) => `${((n / seen) * 100).toFixed(1)}%`

  console.log('■ 필드 채움률')
  for (const f of FIELDS) console.log(`  ${f.padEnd(14)} ${String(filled[f]).padStart(6)} / ${seen}  ${pct(filled[f])}`)

  console.log('\n■ 문구 출현 (행 수, 필드별)')
  console.log(`  ${'패턴'.padEnd(16)} ${FIELDS.map((f) => f.slice(0, 9).padStart(10)).join('')}`)
  for (const p of PATTERNS) {
    const row = FIELDS.map((f) => String(hits[p.key][f]).padStart(10)).join('')
    console.log(`  ${p.key.padEnd(16)}${row}`)
  }

  console.log(`\n■ 어느 필드에서든 한 번이라도 걸린 행: ${anyHit.size} / ${seen}  ${pct(anyHit.size)}`)
  console.log('   (제외·중복 기능이 붙을 수 있는 행 수의 상한이다. 아래가 아니라 위 한계다 —')
  console.log('    걸렸다고 해서 그 문장이 제외 조건이라는 뜻은 아니다.)')

  console.log('\n■ 표본 (패턴별 최대 2건)')
  for (const s of samples) console.log(`  [${s.key} · ${s.field}] …${s.text}…`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
