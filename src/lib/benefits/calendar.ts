import type { BenefitListRow } from './queries'
import { kstDateString } from './status'

export interface WeekGroup { label: string; rows: BenefitListRow[] }

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** 해당 달의 마지막 날. 날짜 0은 전달의 마지막 날이므로 다음 달 0일을 읽는다. */
function endOfMonthOf(iso: string): string {
  const [y, m] = [+iso.slice(0, 4), +iso.slice(5, 7)]
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

/** KST 기준 이번 주(일요일까지) / 다음 주 / 이달 안 / 그 이후. 마감 오름차순. */
export function groupByWeek(rows: BenefitListRow[], now: Date): WeekGroup[] {
  const today = kstDateString(now)
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay() // 0=일
  const daysToSunday = dow === 0 ? 0 : 7 - dow
  const endOfWeek = addDays(today, daysToSunday) // 이번 주 일요일
  const endOfNextWeek = addDays(endOfWeek, 7)
  const endOfMonth = endOfMonthOf(today)
  const sorted = [...rows].filter((r) => r.apply_end && r.apply_end >= today).sort((a, b) => a.apply_end!.localeCompare(b.apply_end!))
  const groups: WeekGroup[] = [
    { label: '이번 주', rows: sorted.filter((r) => r.apply_end! <= endOfWeek) },
    { label: '다음 주', rows: sorted.filter((r) => r.apply_end! > endOfWeek && r.apply_end! <= endOfNextWeek) },
    { label: '이달 안', rows: sorted.filter((r) => r.apply_end! > endOfNextWeek && r.apply_end! <= endOfMonth) },
    { label: '그 이후', rows: sorted.filter((r) => r.apply_end! > endOfNextWeek && r.apply_end! > endOfMonth) },
  ]
  return groups.filter((g) => g.rows.length)
}
