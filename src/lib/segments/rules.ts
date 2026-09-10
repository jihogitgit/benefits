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
const PARENTING_HOUSEHOLDS = new Set(['multi_child', 'single_parent'])

/** 조건 코드와 텍스트 키워드로 세그먼트를 부여한다. 어디에도 해당하지 않으면 ['other']. */
export function tagSegments(text: SegmentTextInput, cond: SegmentCondInput): Segment[] {
  const hay = `${text.title ?? ''} ${text.target_text ?? ''} ${text.summary ?? ''}`
  const out: Segment[] = []

  const youthByAge = cond.age_min !== null && cond.age_max !== null && cond.age_min >= 15 && cond.age_max <= 39
  if (youthByAge || YOUTH_KW.test(hay)) out.push('youth')

  const parentingByCode =
    cond.life_stages.some((s) => PARENTING_STAGES.has(s)) || cond.household_types.some((h) => PARENTING_HOUSEHOLDS.has(h))
  if (parentingByCode || PARENTING_KW.test(hay)) out.push('parenting')

  if (cond.occupations.includes('small_biz') || SMALL_BIZ_KW.test(hay)) out.push('small_biz')

  return out.length ? out : ['other']
}
