import { Fragment } from 'react'
import type { BenefitListRow } from '@/lib/benefits/queries'
import BenefitCard from './BenefitCard'
import AdPlacement from './AdPlacement'

/** 카드 목록. 5번째 항목 뒤에 광고 1개(스펙 7). */
export default function BenefitList({
  rows,
  now,
  emptyText = '조건에 맞는 지원금이 없습니다.',
  showAd = true,
}: {
  rows: BenefitListRow[]
  now?: Date
  emptyText?: string
  /** 한 페이지에 목록이 둘 이상이면 두 번째부터 false. 같은 AdFit 유닛 id를 한 화면에 두 번
   *  올리면 두 번째는 채워지지 않고 자리(minHeight)만 비어 남는다. */
  showAd?: boolean
}) {
  if (!rows.length)
    return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">{emptyText}</p>
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((r, i) => (
        <Fragment key={r.slug}>
          <BenefitCard row={r} now={now} />
          {showAd && i === 4 && (
            <div className="sm:col-span-2">
              <AdPlacement slot="list" />
            </div>
          )}
        </Fragment>
      ))}
    </div>
  )
}
