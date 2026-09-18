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

// 글머리 기호 + (번호·원문자 목록 접두사) + 남은 기호를 제거한다. 기호 목록은 실제 보조금24
// 원문(fixtures/gov24)에서 확인된 것들이다. 번호는 1~2자리에 구분자 뒤 공백까지 있어야 목록으로
// 본다('2026.03.01.'의 연도가 잘리지 않게). 괄호·대괄호로 시작하는 줄은 의미 있는 내용이므로 남긴다.
const BULLET_PREFIX = /^[\s○●◦•‧∙·ㆍ□◇◈▪▫▶►▷☞※＊*\-–]*(?:[①-⑳]|\d{1,2}\s*[.)]\s+)?[\s○●◦•‧∙·ㆍ□◇◈▪▫▶►▷☞※＊*\-–]*/

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

/**
 * 날짜만. 원문이 날짜까지만 주는 값에 쓴다.
 * 손으로 채운 행의 근거 문서 수정일과 대조일이 그렇다 — 시각이 없는 값을 formatKstDate로
 * 찍으면 자정을 변환한 "09:00"이 나와서, 문서에 없는 시각을 있는 것처럼 보이게 한다.
 */
export function formatKstDay(iso: string): string {
  return formatKstDate(iso).slice(0, 10)
}
