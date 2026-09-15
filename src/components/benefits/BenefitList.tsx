import { Fragment } from 'react'
import type { BenefitListRow } from '@/lib/benefits/queries'
import BenefitCard from './BenefitCard'
import AdPlacement from './AdPlacement'

/** 카드 목록. 5번째 항목 뒤에 광고 1개(스펙 7). */
export default function BenefitList({
  rows,
  now,
  emptyText = '조건에 맞는 지원금이 없습니다.',
}: {
  rows: BenefitListRow[]
  now?: Date
  emptyText?: string
}) {
  if (!rows.length)
    return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">{emptyText}</p>
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((r, i) => (
        <Fragment key={r.slug}>
          <BenefitCard row={r} now={now} />
          {i === 4 && (
            <div className="sm:col-span-2">
              <AdPlacement slot="list" />
            </div>
          )}
        </Fragment>
      ))}
    </div>
  )
}
