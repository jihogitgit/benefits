import type { SupportConditionItem } from '@/lib/api/gov24-schema'
import type { Gender } from '@/types/database'
import { CODEMAP, AGE_MIN_CODE, AGE_MAX_CODE } from './codemap'

export interface NormalizedConditions {
  source_id: string
  age_min: number | null
  age_max: number | null
  gender: Gender
  income_bands: string[]
  life_stages: string[]
  household_types: string[]
  occupations: string[]
  unknownCodes: string[]
}

function isOn(v: unknown): boolean {
  return v === 'Y' || v === 'y' || v === 1 || v === '1' || v === true
}

function toAge(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function normalizeConditions(item: SupportConditionItem): NormalizedConditions {
  const out: NormalizedConditions = {
    source_id: item.서비스ID,
    age_min: toAge(item[AGE_MIN_CODE]),
    age_max: toAge(item[AGE_MAX_CODE]),
    gender: 'any',
    income_bands: [],
    life_stages: [],
    household_types: [],
    occupations: [],
    unknownCodes: [],
  }

  let male = false
  let female = false

  for (const [code, value] of Object.entries(item)) {
    if (!code.startsWith('JA') || code === AGE_MIN_CODE || code === AGE_MAX_CODE) continue
    const m = CODEMAP[code]
    if (!m) {
      out.unknownCodes.push(code)
      continue
    }
    if (!isOn(value)) continue
    switch (m.kind) {
      case 'gender':
        if (m.value === 'male') male = true
        else female = true
        break
      case 'income':
        out.income_bands.push(m.value)
        break
      case 'life':
        out.life_stages.push(m.value)
        break
      case 'household':
        out.household_types.push(m.value)
        break
      case 'occupation':
        out.occupations.push(m.value)
        break
      case 'ignore':
        break
    }
  }

  out.gender = male && !female ? 'male' : female && !male ? 'female' : 'any'
  return out
}
