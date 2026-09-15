import type { DeadlineType } from '@/types/database'
import { daysUntil } from '@/lib/benefits/status'
import { ddayLabel } from '@/lib/benefits/format'
import { cn } from '@/lib/utils'

/*
 * 마감 유형별 배지. 주목도 순서가 곧 위계다.
 *   빨강(14일 이내)  긴급 — 지금 안 하면 놓친다
 *   브랜드색(그 외)   일정 있음
 *   진회색(상시)     급하지 않음 — 언제든 신청 가능
 *   연회색(미상)     정보 없음 — 가장 약하게
 * 상시를 초록에서 회색으로 내린 이유: 브랜드가 청록이라 초록 배지와 한 화면에서 구분되지 않는다.
 * 상시는 긍정 속성이지만 긴급하지 않으므로 주의를 끌 이유도 없다.
 */
export default function DdayBadge({
  deadline_type,
  apply_end,
  now,
}: {
  deadline_type: DeadlineType
  apply_end: string | null
  now?: Date
}) {
  if (deadline_type === 'always')
    return <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">상시</span>

  const d = daysUntil(apply_end, now)
  const label = ddayLabel(d)
  if (!label) return <span className="rounded bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-gray-500">공고 확인</span>

  const urgent = d !== null && d <= 14
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-xs font-semibold', urgent ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand-700')}>
      {label}
    </span>
  )
}
