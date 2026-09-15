import { AGE_BANDS, type AgeBand } from '@/lib/benefits/age-bands'
import { SITUATION_TO_CONDITIONS } from '@/lib/conditions/codemap'
import { REGIONS } from '../../../data/regions'

export const AGE_OPTIONS: { value: AgeBand; label: string }[] = [
  { value: '10s', label: '10대' },
  { value: '20s', label: '20대' },
  { value: '30s', label: '30대' },
  { value: '40s', label: '40대' },
  { value: '50s+', label: '50대 이상' },
]

export const SITUATION_OPTIONS: { value: string; label: string }[] = [
  { value: 'pregnancy', label: '임신·출산' },
  { value: 'has_child', label: '자녀 있음' },
  { value: 'job_seeker', label: '구직 중' },
  { value: 'business', label: '사업자' },
  { value: 'single', label: '1인 가구' },
  { value: 'no_house', label: '무주택' },
  { value: 'student', label: '대학(원)생' },
]

export const REGION_OPTIONS: { value: string; label: string }[] = REGIONS.map((r) => ({ value: r.slug, label: r.name }))

export const VALID_AGE = new Set<string>(AGE_BANDS)
export const VALID_SITUATION = new Set(Object.keys(SITUATION_TO_CONDITIONS))
export const VALID_REGION = new Set(REGIONS.map((r) => r.slug))
