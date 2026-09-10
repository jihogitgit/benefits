import type { ServiceListItem } from '@/lib/api/gov24-schema'
import type { BenefitRow } from '@/types/database'
import { parseDeadline } from '@/lib/benefits/deadline'
import { computeStatus } from '@/lib/benefits/status'
import { tagSegments } from '@/lib/segments/rules'
import { extractRegion } from '@/lib/regions/extract'

export const GOV24_SOURCE = 'gov24'

export interface CondForNormalize {
  age_min: number | null
  age_max: number | null
  life_stages: string[]
  occupations: string[]
  household_types: string[]
}

const EMPTY_COND: CondForNormalize = { age_min: null, age_max: null, life_stages: [], occupations: [], household_types: [] }

/** 보조금24 일시 'YYYYMMDDHHmmss' (KST) 또는 'YYYY-MM-DD HH:mm[:ss]' → ISO UTC */
export function kstToIso(text: string | null | undefined): string | null {
  if (!text) return null
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/)
  const dashed = text.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  const m = compact ?? dashed
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 9, +m[5], +(m[6] ?? 0)))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function normalizeBenefit(item: ServiceListItem, cond: CondForNormalize | null, slug: string, now: Date): BenefitRow {
  const deadline = parseDeadline(item.신청기한)
  const segments = tagSegments(
    { title: item.서비스명, target_text: item.지원대상 ?? null, summary: item.서비스목적요약 ?? null },
    cond ?? EMPTY_COND,
  )

  return {
    source: GOV24_SOURCE,
    source_id: item.서비스ID,
    slug,
    title: item.서비스명.trim(),
    summary: item.서비스목적요약 ?? null,
    amount_text: item.지원내용 ?? null,
    target_text: item.지원대상 ?? null,
    criteria_text: item.선정기준 ?? null,
    apply_method: item.신청방법 ?? null,
    apply_url: item.상세조회URL ?? null,
    agency: item.소관기관명 ?? null,
    contact: item.전화문의 ?? null,
    deadline_type: deadline.deadline_type,
    apply_start: deadline.apply_start,
    apply_end: deadline.apply_end,
    region_code: extractRegion(item.소관기관명),
    segments,
    status: computeStatus(deadline, now),
    source_updated_at: kstToIso(item.수정일시) ?? kstToIso(item.등록일시),
    synced_at: now.toISOString(),
  }
}
