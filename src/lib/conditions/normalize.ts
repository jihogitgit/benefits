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

/** 'JA0404' → 'JA04' */
function groupOf(code: string): string {
  return code.slice(0, 4)
}

/** codemap에 정의된 코드를 그룹별로 묶은 것. 그룹 전체가 Y인지 판정할 때 쓴다. */
const GROUP_CODES: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>()
  for (const code of Object.keys(CODEMAP)) {
    const g = groupOf(code)
    m.set(g, [...(m.get(g) ?? []), code])
  }
  return m
})()

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

  // 그룹(JA01, JA02, JA03, JA04, JA11, JA12, JA21, JA22)의 알려진 코드가 대부분 'Y'면
  // "해당 축에 제한 없음"을 뜻한다(실데이터 규약). 그 그룹은 조건으로 넣지 않는다.
  //
  // 예전에는 '전부 Y'일 때만 제한 없음으로 봤다. 그런데 가구유형(JA04) 9개 중 7~8개만 켠 행이
  // 원천 5,000건에 131건 있고, 이걸 "이 7~8개 유형이 대상"으로 읽으면 어떤 상황을 골라도
  // 매칭돼 점수 만점을 받는다. 실제로 '6.25 참전유공자 위문금'이 가구유형 7개를 달고 있어
  // 20대·무주택 진단의 최상단에 올라왔다. 소수를 뺀 것은 대상을 좁히려는 표기가 아니라
  // 그냥 덜 채운 표기에 가깝다.
  //
  // 2/3을 기준으로 삼는다. JA04(9개)는 6개, JA01(성별 2개)은 2개라 종전과 같고,
  // 진짜로 좁게 지정한 행(대부분 1~3개)은 그대로 조건으로 남는다.
  const codes = Object.keys(item).filter((k) => k.startsWith('JA') && k !== AGE_MIN_CODE && k !== AGE_MAX_CODE)
  const unrestricted = new Set<string>()
  for (const [g, known] of GROUP_CODES) {
    const onCount = known.filter((c) => isOn(item[c])).length
    if (onCount >= Math.ceil((known.length * 2) / 3)) unrestricted.add(g)
  }

  for (const code of codes) {
    const value = item[code]
    const m = CODEMAP[code]
    if (!m) {
      out.unknownCodes.push(code)
      continue
    }
    if (!isOn(value) || unrestricted.has(groupOf(code))) continue
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
