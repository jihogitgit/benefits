export type DeadlineType = 'always' | 'period' | 'unknown'
export type BenefitStatus = 'open' | 'closed' | 'removed'
export type Gender = 'any' | 'male' | 'female'
export type Segment = 'youth' | 'parenting' | 'small_biz' | 'other'

export interface BenefitRow {
  source: string
  source_id: string
  slug: string
  title: string
  summary: string | null
  amount_text: string | null
  target_text: string | null
  criteria_text: string | null
  apply_method: string | null
  apply_url: string | null
  agency: string | null
  contact: string | null
  deadline_type: DeadlineType
  apply_start: string | null // YYYY-MM-DD
  apply_end: string | null
  region_code: string
  segments: Segment[]
  status: BenefitStatus
  source_updated_at: string | null // ISO 8601 UTC
  synced_at: string
}

export interface ConditionRow {
  benefit_id: string
  age_min: number | null
  age_max: number | null
  gender: Gender
  income_bands: string[]
  life_stages: string[]
  household_types: string[]
  occupations: string[]
  region_codes: string[]
}

export interface SyncRunRow {
  source: string
  started_at: string
  finished_at: string | null
  fetched: number
  upserted: number
  skipped: number
  failed: number
  closed: number
  removed: number
  error: string | null
  aborted_reason: string | null
}
