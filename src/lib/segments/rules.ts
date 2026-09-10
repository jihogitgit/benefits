import type { Segment } from '@/types/database'

export interface SegmentTextInput {
  title: string | null
  target_text: string | null
  summary: string | null
}

export interface SegmentCondInput {
  age_min: number | null
  age_max: number | null
  life_stages: string[]
  occupations: string[]
  household_types: string[]
}

const YOUTH_KW = /청년|대학생|취업준비|신혼부부/
const PARENTING_KW = /임산부|임신|출산|산모|산후|영유아|영아|유아|아동|양육|육아|보육|어린이집|유치원|다자녀|출생|첫만남|부모급여|아이돌봄/
const SMALL_BIZ_KW = /소상공인|자영업|소기업|점포|창업|사업자|가게|상인|전통시장|폐업/

const PARENTING_STAGES = new Set(['pre_parent', 'pregnancy', 'birth', 'elementary'])
// 이 나이 이하를 대상으로 하면 보호자가 신청하는 아동 지원으로 본다
const CHILD_AGE_MAX = 12

/** 조건 코드와 텍스트 키워드로 세그먼트를 부여한다. 어디에도 해당하지 않으면 ['other']. */
export function tagSegments(text: SegmentTextInput, cond: SegmentCondInput): Segment[] {
  const hay = `${text.title ?? ''} ${text.target_text ?? ''} ${text.summary ?? ''}`
  const out: Segment[] = []

  const youthByAge = cond.age_min !== null && cond.age_max !== null && cond.age_min >= 18 && cond.age_max <= 39
  if (youthByAge || YOUTH_KW.test(hay)) out.push('youth')

  // 한부모·다자녀 같은 가구 유형만으로는 판정하지 않는다. 복지 서비스 대부분이 여러 가구 유형을 함께 나열해 오탐이 크다.
  const childByAge = cond.age_max !== null && cond.age_max <= CHILD_AGE_MAX
  const parentingByCode = cond.life_stages.some((s) => PARENTING_STAGES.has(s)) || childByAge
  if (parentingByCode || PARENTING_KW.test(hay)) out.push('parenting')

  if (cond.occupations.includes('small_biz') || SMALL_BIZ_KW.test(hay)) out.push('small_biz')

  return out.length ? out : ['other']
}
