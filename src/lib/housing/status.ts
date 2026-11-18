import type { HousingStatus } from '@/types/housing'
import { kstDateString } from '@/lib/benefits/status'

type Dated = { status: HousingStatus; receipt_start: string | null; receipt_end: string | null }

/**
 * 화면에 쓸 상태. DB의 status는 동기화가 돈 날의 값이라, 동기화가 밀리면 접수가 끝난 공고가 '접수중'으로 남는다
 * (2026-11: cron이 시간 예산을 넘겨 일주일 동안 그랬다). 접수 일자가 있으면 오늘(KST) 기준으로 다시 센다.
 * 일자가 없는 공고(LH)는 원문 상태뿐이라 DB 값을 그대로 쓴다. closed·removed는 되살리지 않는다.
 */
export function effectiveHousingStatus(r: Dated, now: Date): HousingStatus {
  if (r.status !== 'open' && r.status !== 'upcoming') return r.status
  if (!r.receipt_start && !r.receipt_end) return r.status
  const today = kstDateString(now)
  if (r.receipt_end && today > r.receipt_end) return 'closed'
  if (r.receipt_start && today < r.receipt_start) return 'upcoming'
  return 'open'
}

const byDate = (a: string | null, b: string | null) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1)

/**
 * 접수중·예정 목록의 순서. 접수중이 먼저(마감 임박 순), 그다음 접수 예정(접수 시작이 가까운 순).
 * 일자가 없는 공고는 각 묶음의 뒤. 같은 날은 slug 순으로 고정한다.
 */
export function sortActiveHousing<T extends Dated & { slug: string }>(rows: T[]): T[] {
  const rank = (r: T) => (r.status === 'open' ? 0 : 1)
  return [...rows].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.status === 'open' ? byDate(a.receipt_end, b.receipt_end) : byDate(a.receipt_start, b.receipt_start)) ||
      (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
  )
}
