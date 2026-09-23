import Link from 'next/link'
import type { BenefitListRow } from '@/lib/benefits/queries'
import { firstLine } from '@/lib/benefits/format'
import { REGIONS, REGION_ALL } from '../../../data/regions'
import DdayBadge from './DdayBadge'

const REGION_NAME: Record<string, string | undefined> = Object.fromEntries(REGIONS.map((r) => [r.slug, r.name]))

export function regionName(code: string): string {
  return code === REGION_ALL ? '전국' : (REGION_NAME[code] ?? code)
}

export default function BenefitCard({ row, now }: { row: BenefitListRow; now?: Date }) {
  const amount = firstLine(row.amount_text, 80)
  return (
    <article className="relative flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm focus-within:border-brand-400">
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <DdayBadge deadline_type={row.deadline_type} apply_end={row.apply_end} now={now} />
        <span className="text-xs text-gray-500">{regionName(row.region_code)}</span>
        {/* gray-400은 흰 배경 대비 2.6:1로 AA(4.5:1) 미달이었다. 카드마다 한 번씩 나오므로
            홈에서만 18곳이 걸렸다. */}
        {row.agency && <span className="text-xs text-gray-500">· {row.agency}</span>}
      </div>
      <h3 className="text-base font-semibold leading-snug">
        {/* after:inset-0 로 카드 전체를 클릭 영역으로 넓힌다. 접근성 이름은 제목만 유지된다. */}
        <Link href={`/benefit/${row.slug}`} className="after:absolute after:inset-0 after:rounded-xl hover:text-brand-700">
          {row.title}
        </Link>
      </h3>
      {amount && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{amount}</p>}
    </article>
  )
}
