import Link from 'next/link'
import type { HousingCardRow } from '@/lib/housing/queries'
import { KIND_LABEL, STATUS_LABEL } from '@/lib/housing/labels'
import { regionName } from '@/components/benefits/BenefitCard'
import DdayBadge from '@/components/benefits/DdayBadge'
import { daysUntil } from '@/lib/benefits/status'

/**
 * 공고 카드. 청약홈은 상세(/housing/[slug])로, LH는 API가 일정·세대수를 주지 않아 상세 없이 LH 원문으로 보낸다.
 *
 * D-day: 접수중은 지원금 카드와 같은 DdayBadge(클라이언트에서 다시 센다). 접수 예정은 "D-n 접수 시작"을
 * 서버에서 찍는다 — 목록은 하루 ISR + cron이 매일 housing:lists를 비우므로 하루 이상 어긋나지 않는다.
 * 특별공급 배지는 세대수가 있을 때만 — 오피스텔·LH는 집계가 없어 0이라 배지가 안 뜬다(의도).
 */
export default function HousingCard({ row, now }: { row: HousingCardRow; now?: Date }) {
  const external = row.source === 'lh'
  const href = external ? row.detail_url ?? '' : `/housing/${row.slug}`
  const badges = [
    row.sp_newlywed_units > 0 && '신혼부부 특공',
    row.sp_first_life_units > 0 && '생애최초 특공',
    row.sp_multi_child_units > 0 && '다자녀 특공',
  ].filter((b): b is string => !!b)

  return (
    <article className="relative flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm focus-within:border-brand-400">
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <StatusBadge row={row} now={now} />
        <span className="text-xs text-gray-500">{(row.region_code !== 'UNKNOWN' && regionName(row.region_code)) || '지역 미상'}</span>
        <span aria-hidden className="text-xs text-gray-400">·</span>
        <span className="text-xs text-gray-500">{KIND_LABEL[row.kind]}</span>
      </div>
      <h3 className="text-base font-semibold leading-snug">
        {external && !row.detail_url ? (
          <span>{row.title}</span>
        ) : external ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="after:absolute after:inset-0 after:rounded-xl hover:text-brand-700">
            {row.title} <span aria-hidden className="text-gray-400">↗</span>
            <span className="sr-only">(새 창)</span>
          </a>
        ) : (
          <Link href={href} className="after:absolute after:inset-0 after:rounded-xl hover:text-brand-700">
            {row.title}
          </Link>
        )}
      </h3>
      <p className="mt-1 text-sm text-gray-600">
        {[row.kind_detail, row.total_units ? `${row.total_units.toLocaleString()}세대` : null].filter(Boolean).join(' · ')}
      </p>
      {badges.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1" aria-label="특별공급">
          {badges.map((b) => (
            <li key={b} className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">{b}</li>
          ))}
        </ul>
      )}
    </article>
  )
}

function StatusBadge({ row, now }: { row: HousingCardRow; now?: Date }) {
  if (row.status === 'open' && row.receipt_end) return <DdayBadge deadline_type="period" apply_end={row.receipt_end} now={now} />
  if (row.status === 'upcoming' && row.receipt_start) {
    const d = daysUntil(row.receipt_start, now)
    return <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-700">{d !== null && d > 0 ? `D-${d} 접수 시작` : '접수 예정'}</span>
  }
  const tone = row.status === 'closed' || row.status === 'removed' ? 'bg-gray-100 text-gray-600' : 'bg-brand-50 text-brand-700'
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tone}`}>{STATUS_LABEL[row.status]}</span>
}
