import type { HousingDetail } from '@/lib/housing/queries'

const dots = (d: string | null) => (d ? d.replace(/-/g, '.') : null)
const range = (a: string | null, b: string | null) => (a && b && a !== b ? `${dots(a)} ~ ${dots(b)}` : dots(a ?? b))

/** 청약홈 공고의 일정. 값이 없는 줄은 내지 않는다 — 빈 칸이 "미정"처럼 읽힌다. */
export default function HousingSchedule({ d }: { d: HousingDetail }) {
  const rows: [string, string | null][] = [
    ['모집공고일', dots(d.notice_date)],
    ['특별공급 접수', range(d.special_start, d.special_end)],
    ['1순위 접수', range(d.rank1_start, d.rank1_end)],
    ['2순위 접수', range(d.rank2_start, d.rank2_end)],
    ['당첨자 발표', dots(d.winner_date)],
    ['계약', range(d.contract_start, d.contract_end)],
    ['입주 예정', d.move_in_ym ? `${d.move_in_ym.slice(0, 4)}년 ${Number(d.move_in_ym.slice(4, 6))}월` : null],
  ]
  const shown = rows.filter((r): r is [string, string] => !!r[1])
  if (!shown.length) return null
  return (
    <dl className="divide-y rounded-xl border bg-white text-sm">
      {shown.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 p-3">
          <dt className="text-gray-500">{k}</dt>
          <dd className="font-medium tabular-nums text-gray-900">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
