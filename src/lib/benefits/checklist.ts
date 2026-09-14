import type { ConditionJoin } from './queries'
import type { Diagnosis } from '@/lib/diagnosis/storage'
import { ageBandToRange } from './search'
import { SITUATION_TO_CONDITIONS } from '@/lib/conditions/codemap'
import { REGIONS } from '../../../data/regions'

export interface CheckItem {
  key: string // 'age' | 'region' | 'gender' | 'household:x' | 'occupation:x' | 'life:x' | 'income:x' | 검수자가 정한 키
  label: string
}
export type CheckState = 'pass' | 'fail' | 'unknown'
export interface EvaluatedItem extends CheckItem {
  state: CheckState
}

const REGION_NAME: Record<string, string> = Object.fromEntries(REGIONS.map((r) => [r.slug, r.name]))

/** 상한 100 이상은 원천에서 '제한 없음'을 뜻하므로 상한 없음과 같게 쓴다. */
const AGE_UNBOUNDED = 100

function ageLabel(min: number | null, max: number | null): string {
  if (min !== null && (max === null || max >= AGE_UNBOUNDED)) return `만 ${min}세 이상`
  if (min === null && max !== null) return `만 ${max}세 이하`
  return `만 ${min}~${max}세`
}

const HOUSEHOLD_LABEL: Record<string, string> = {
  multicultural: '다문화가족', defector: '북한이탈주민', single_parent: '한부모·조손 가정', single: '1인 가구',
  multi_child: '다자녀 가구', no_house: '무주택 세대', new_resident: '신규 전입', extended: '확대가족', disabled: '장애인', veteran: '국가보훈대상자',
}
const OCCUPATION_LABEL: Record<string, string> = {
  farmer: '농업인', fisher: '어업인', livestock: '축산업인', forester: '임업인', college: '대학(원)생',
  worker: '근로자·직장인', job_seeker: '구직자·실업자', small_biz: '소상공인·중소기업',
}
const LIFE_LABEL: Record<string, string> = {
  pre_parent: '예비부모·난임', pregnancy: '임산부', birth: '출산·입양 가정', elementary: '초등학생', middle_school: '중학생', high_school: '고등학생',
}
const INCOME_LABEL: Record<string, string> = { '0-50': '중위소득 50% 이하', '51-75': '중위소득 51~75%', '76-100': '중위소득 76~100%', '101-200': '중위소득 101~200%', '200+': '중위소득 200% 초과' }

/** 검수된 checklist_json이 있으면 그것을, 없으면 조건 행으로 자동 생성. */
export function buildChecklist(cond: ConditionJoin | null, reviewed: { label: string; condition_key: string }[] | null): CheckItem[] {
  if (reviewed && reviewed.length) return reviewed.map((r) => ({ key: r.condition_key, label: r.label }))
  if (!cond) return []
  const items: CheckItem[] = []
  // age_min·age_max는 스키마상 각각 독립적으로 null일 수 있다(실데이터에 한쪽만 있는 행이 존재한다).
  // 둘 다 있을 때만 항목을 만들면 "만 65세 이상" 같은 조건이 체크리스트에서 통째로 빠져,
  // 나머지 조건만 충족한 사용자에게 "모두 충족"이라는 잘못된 안내가 나간다.
  if (cond.age_min !== null || cond.age_max !== null) {
    items.push({ key: 'age', label: ageLabel(cond.age_min, cond.age_max) })
  }
  if (cond.gender !== 'any') items.push({ key: 'gender', label: cond.gender === 'female' ? '여성' : '남성' })
  if (cond.region_codes.length) items.push({ key: 'region', label: `${cond.region_codes.map((c) => REGION_NAME[c] ?? c).join('·')} 거주` })
  if (cond.income_bands.length) items.push({ key: `income:${cond.income_bands.join('|')}`, label: cond.income_bands.map((b) => INCOME_LABEL[b] ?? b).join(' 또는 ') })
  for (const l of cond.life_stages) items.push({ key: `life:${l}`, label: LIFE_LABEL[l] ?? l })
  for (const h of cond.household_types) items.push({ key: `household:${h}`, label: HOUSEHOLD_LABEL[h] ?? h })
  for (const o of cond.occupations) items.push({ key: `occupation:${o}`, label: OCCUPATION_LABEL[o] ?? o })
  return items
}

function situationCovers(situations: string[], kind: 'life' | 'household' | 'occupation', value: string): boolean {
  return situations.some((s) => (SITUATION_TO_CONDITIONS[s]?.[kind] ?? []).includes(value))
}

/** 진단값으로 각 항목을 pass/fail/unknown으로 평가. 판정 근거가 없는 항목은 unknown. */
export function evaluateChecklist(items: CheckItem[], cond: ConditionJoin | null, d: Diagnosis): EvaluatedItem[] {
  return items.map((it) => {
    let state: CheckState = 'unknown'
    if (it.key === 'age' && cond && (cond.age_min !== null || cond.age_max !== null)) {
      const r = ageBandToRange(d.ageBand)
      // 열린 쪽은 경계 없음으로 본다. ageBandToRange의 상한과 맞춰 120을 쓴다.
      if (r) state = r[1] < (cond.age_min ?? 0) || r[0] > (cond.age_max ?? 120) ? 'fail' : 'pass'
    } else if (it.key === 'region' && cond?.region_codes.length) {
      if (d.region) state = cond.region_codes.includes(d.region) ? 'pass' : 'fail'
    } else if (it.key.startsWith('household:') || it.key.startsWith('occupation:') || it.key.startsWith('life:')) {
      const [kind, value] = it.key.split(':') as ['household' | 'occupation' | 'life', string]
      if (d.situations.length && situationCovers(d.situations, kind, value)) state = 'pass'
    }
    return { ...it, state }
  })
}

export function summarize(evaluated: EvaluatedItem[]): string {
  if (!evaluated.length) return ''
  const pass = evaluated.filter((e) => e.state === 'pass').length
  const fail = evaluated.filter((e) => e.state === 'fail').length
  if (fail > 0) return `${evaluated.length}개 중 ${fail}개가 내 조건과 다릅니다. 공식 페이지에서 확인해 보세요.`
  if (pass === evaluated.length) return `${evaluated.length}개 조건 모두 충족! 바로 신청해 보세요.`
  if (pass > 0) return `${evaluated.length}개 중 ${pass}개 충족 · 나머지는 직접 확인하세요.`
  return '홈에서 조건을 고르면 자동으로 체크됩니다.'
}
