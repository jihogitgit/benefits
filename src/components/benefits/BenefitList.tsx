import { Fragment } from 'react'
import type { BenefitListRow } from '@/lib/benefits/queries'
import BenefitCard from './BenefitCard'
import AdPlacement from './AdPlacement'

/**
 * 카드 목록. showAd가 켜진 곳에서만 5번째 항목 뒤에 광고 1개(스펙 7).
 *
 * 기본값은 꺼짐이다. 허브·목록·마감 페이지는 카드 반복이 본문의 대부분이라 광고를 붙이면
 * "가치가 별로 없는 콘텐츠에 광고를 단 사이트"로 보인다(2026-10·11 애드센스 거절 사유, AdsenseScript 주석).
 * 광고는 해설이 게재된 상세와 가이드에만 싣는다 — 목록에서 켜려면 명시적으로 showAd를 넘긴다.
 */
export default function BenefitList({
  rows,
  now,
  emptyText = '조건에 맞는 지원금이 없습니다.',
  showAd = false,
}: {
  rows: BenefitListRow[]
  now?: Date
  emptyText?: string
  /** 켤 때는 한 페이지에 하나만. 같은 AdFit 유닛 id를 한 화면에 두 번 올리면 두 번째는
   *  채워지지 않고 자리(minHeight)만 비어 남는다. */
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
