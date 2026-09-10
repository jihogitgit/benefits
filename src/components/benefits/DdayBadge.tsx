import type { DeadlineType } from '@/types/database'
import { daysUntil } from '@/lib/benefits/status'
import { ddayLabel } from '@/lib/benefits/format'
import { cn } from '@/lib/utils'

/** 마감 유형별 배지. 상시는 초록, 14일 이내는 빨강, 그 외는 남색, 마감일 미상은 회색. */
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
    return <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">상시</span>

  const d = daysUntil(apply_end, now)
  const label = ddayLabel(d)
  if (!label) return <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">공고 확인</span>

  const urgent = d !== null && d <= 14
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-xs font-semibold', urgent ? 'bg-red-50 text-red-700' : 'bg-indigo-50 text-indigo-700')}>
      {label}
    </span>
  )
}
