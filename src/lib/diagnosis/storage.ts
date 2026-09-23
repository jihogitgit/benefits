import type { AgeBand } from '@/lib/benefits/age-bands'
import { normalizeQuery } from '@/lib/benefits/query-text'
import { VALID_AGE, VALID_SITUATION, VALID_REGION, VALID_INCOME } from './options'

export interface Diagnosis {
  /** 자유 입력 검색어. 필터와 AND로 묶여 '고른 조건 안에서 다시 찾기'가 된다. 없으면 빈 문자열. */
  q: string
  ageBand: AgeBand | null
  situations: string[]
  region: string | null
  /**
   * 중위소득 구간. /median-income 계산기가 채우고, 진단 패널은 읽기만 한다.
   * 소득은 칩으로 고르게 하지 않는다 — 가구원 수와 금액을 받아 계산해야 나오는 값이라
   * "대충 어느 구간" 을 사용자에게 묻는 순간 답이 틀린다.
   */
  incomeBand: string | null
}

export const STORAGE_KEY = 'diagnosis'

/** 읽기 전용 기본값. 호출자가 실수로 변형하지 못하게 동결한다. 새 객체가 필요하면 emptyDiagnosis(). */
export const EMPTY: Diagnosis = Object.freeze({ q: '', ageBand: null, situations: [], region: null, incomeBand: null }) as Diagnosis

/** 매번 새 객체를 돌려준다. 호출자가 situations를 직접 변형해도 모듈 상태가 오염되지 않는다. */
export function emptyDiagnosis(): Diagnosis {
  return { q: '', ageBand: null, situations: [], region: null, incomeBand: null }
}

function sanitize(raw: unknown): Diagnosis {
  if (!raw || typeof raw !== 'object') return emptyDiagnosis()
  const o = raw as Record<string, unknown>
  const ageBand = typeof o.ageBand === 'string' && VALID_AGE.has(o.ageBand) ? (o.ageBand as AgeBand) : null
  // 중복 제거: 손으로 편집한 payload가 캐시 키를 무한정 늘리지 못하게 한다
  const situations = Array.isArray(o.situations)
    ? [...new Set(o.situations.filter((s): s is string => typeof s === 'string' && VALID_SITUATION.has(s)))]
    : []
  const region = typeof o.region === 'string' && VALID_REGION.has(o.region) ? o.region : null
  // 손으로 편집한 localStorage나 옛 저장본이 그대로 API 쿼리로 나가지 않도록 여기서 한 번 더 정규화한다.
  const q = typeof o.q === 'string' ? normalizeQuery(o.q) : ''
  const incomeBand = typeof o.incomeBand === 'string' && VALID_INCOME.has(o.incomeBand) ? o.incomeBand : null
  return { q, ageBand, situations, region, incomeBand }
}

export function readDiagnosis(): Diagnosis {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? sanitize(JSON.parse(raw)) : emptyDiagnosis()
  } catch {
    return emptyDiagnosis()
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
  if (d.q) sp.set('q', d.q)
  if (d.ageBand) sp.set('age', d.ageBand)
  if (d.situations.length) sp.set('situations', d.situations.join(','))
  if (d.region) sp.set('region', d.region)
  if (d.incomeBand) sp.set('income', d.incomeBand)
  return sp
}

/**
 * 쿼리스트링을 진단값으로. toSearchParams의 역방향이며 같은 허용목록(sanitize)을 거친다.
 *
 * 가이드 글에서 "무주택 20대 지원금 2,637건 보기" 같은 링크를 걸려면 조건이 URL에 실려야 한다.
 * 진단값이 localStorage에만 있으면 그런 링크를 만들 수 없고, 독자를 홈으로 보내 조건을 다시
 * 고르게 해야 한다.
 */
export function fromSearchParams(sp: URLSearchParams): Diagnosis {
  return sanitize({
    q: sp.get('q') ?? '',
    ageBand: sp.get('age'),
    situations: (sp.get('situations') ?? '').split(',').map((x) => x.trim()).filter(Boolean),
    region: sp.get('region'),
    incomeBand: sp.get('income'),
  })
}

export function isEmpty(d: Diagnosis): boolean {
  return !d.q && !d.ageBand && d.situations.length === 0 && !d.region && !d.incomeBand
}
