import type { HousingCardRow } from '@/lib/housing/queries'
import HousingCard from './HousingCard'

/** 카드 격자. 광고는 싣지 않는다(허용 목록: adsense-scope.test.ts). */
export default function HousingList({ rows, now, emptyText = '해당하는 공고가 없습니다.' }: { rows: HousingCardRow[]; now?: Date; emptyText?: string }) {
  if (!rows.length) return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">{emptyText}</p>
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => <HousingCard key={r.slug} row={r} now={now} />)}
    </div>
  )
}
