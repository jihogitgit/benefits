import type { AgeBand } from '@/lib/benefits/search'
import { VALID_AGE, VALID_SITUATION, VALID_REGION } from './options'

export interface Diagnosis {
  ageBand: AgeBand | null
  situations: string[]
  region: string | null
}

export const STORAGE_KEY = 'diagnosis'
export const EMPTY: Diagnosis = { ageBand: null, situations: [], region: null }

function sanitize(raw: unknown): Diagnosis {
  if (!raw || typeof raw !== 'object') return EMPTY
  const o = raw as Record<string, unknown>
  const ageBand = typeof o.ageBand === 'string' && VALID_AGE.has(o.ageBand) ? (o.ageBand as AgeBand) : null
  const situations = Array.isArray(o.situations) ? o.situations.filter((s): s is string => typeof s === 'string' && VALID_SITUATION.has(s)) : []
  const region = typeof o.region === 'string' && VALID_REGION.has(o.region) ? o.region : null
  return { ageBand, situations, region }
}

export function readDiagnosis(): Diagnosis {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? sanitize(JSON.parse(raw)) : EMPTY
  } catch {
    return EMPTY
  }
}

export function writeDiagnosis(d: Diagnosis): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitize(d)))
  } catch {
    // 사생활 보호 모드 등에서 저장 실패는 무시
  }
}

export function toSearchParams(d: Diagnosis): URLSearchParams {
  const sp = new URLSearchParams()
  if (d.ageBand) sp.set('age', d.ageBand)
  if (d.situations.length) sp.set('situations', d.situations.join(','))
  if (d.region) sp.set('region', d.region)
  return sp
}

export function isEmpty(d: Diagnosis): boolean {
  return !d.ageBand && d.situations.length === 0 && !d.region
}
