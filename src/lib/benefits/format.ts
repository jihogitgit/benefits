import type { DeadlineType } from '@/types/database'

export function ddayLabel(dday: number | null): string | null {
  if (dday === null) return null
  if (dday < 0) return '마감됨'
  if (dday === 0) return '오늘 마감'
  return `D-${dday}`
}

function dots(iso: string): string {
  return iso.replace(/-/g, '.')
}

export function deadlineLabel(b: { deadline_type: DeadlineType | string; apply_start: string | null; apply_end: string | null }): string {
  if (b.deadline_type === 'always') return '상시 신청'
  if (b.deadline_type === 'period' && b.apply_end) {
    return b.apply_start ? `${dots(b.apply_start)} ~ ${dots(b.apply_end)}` : `${dots(b.apply_end)}까지`
  }
  return '공고 확인'
}

// 글머리 기호 + (번호 목록 접두사) + 남은 기호를 제거한다.
// 번호는 1~2자리에 구분자 뒤 공백까지 있어야 목록으로 본다('2026.03.01.'의 연도가 잘리지 않게).
const BULLET_PREFIX = /^[\s○●◦•\-–·※▶►]*(?:\d{1,2}\s*[.)]\s+)?[\s○●◦•\-–·※▶►]*/

/** 원문에서 첫 의미 있는 줄. 글머리 기호 제거, 120자 상한. */
export function firstLine(text: string | null | undefined, max = 120): string | null {
  if (!text) return null
  const line = text
    .split(/\r?\n/)
    .map((l) => l.replace(BULLET_PREFIX, '').trim())
    .find((l) => l.length > 0)
  if (!line) return null
  return line.length > max ? line.slice(0, max) : line
}

export function formatKstDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}
