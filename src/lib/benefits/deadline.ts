import type { DeadlineType } from '@/types/database'

export interface ParsedDeadline {
  deadline_type: DeadlineType
  apply_start: string | null
  apply_end: string | null
}

const ALWAYS = /상시|연중|수시|소진\s*시|소진시까지|제한\s*없음/
// 2026.03.01 / 2026-03-01 / 2026/03/01 / 2026년 3월 1일 / 2026.1.1.
const DATE = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/g

function toIso(y: string, m: string, d: string): string {
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

/** 보조금24 '신청기한' 자유 텍스트를 기간/상시/미확정으로 해석한다. */
export function parseDeadline(text: string | null | undefined): ParsedDeadline {
  const none: ParsedDeadline = { deadline_type: 'unknown', apply_start: null, apply_end: null }
  if (!text) return none

  const dates = [...text.matchAll(DATE)].map((m) => toIso(m[1], m[2], m[3]))
  if (dates.length >= 2) return { deadline_type: 'period', apply_start: dates[0], apply_end: dates[1] }
  if (dates.length === 1) return { deadline_type: 'period', apply_start: null, apply_end: dates[0] }
  if (ALWAYS.test(text)) return { deadline_type: 'always', apply_start: null, apply_end: null }
  return none
}
