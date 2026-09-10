import type { BenefitStatus, DeadlineType } from '@/types/database'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** now를 KST 달력 날짜(YYYY-MM-DD)로 */
export function kstDateString(now: Date): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10)
}

export function computeStatus(
  b: { deadline_type: DeadlineType; apply_end: string | null },
  now: Date = new Date(),
): BenefitStatus {
  if (b.deadline_type !== 'period' || !b.apply_end) return 'open'
  return b.apply_end < kstDateString(now) ? 'closed' : 'open'
}

/** KST 기준 남은 일수. 오늘이면 0, 지났으면 음수, 마감일 없으면 null */
export function daysUntil(applyEnd: string | null, now: Date = new Date()): number | null {
  if (!applyEnd) return null
  const end = Date.UTC(+applyEnd.slice(0, 4), +applyEnd.slice(5, 7) - 1, +applyEnd.slice(8, 10))
  const today = kstDateString(now)
  const start = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10))
  return Math.round((end - start) / 86_400_000)
}
