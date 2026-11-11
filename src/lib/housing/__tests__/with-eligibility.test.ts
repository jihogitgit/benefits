import { describe, it, expect, vi } from 'vitest'

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('@/lib/supabase/server', () => ({ createPublicClient: vi.fn() }))

import { withEligibility, type HousingCardRow } from '../queries'
import { ELIGIBILITY_GUIDES } from '../eligibility-guides'

const row = (over: Partial<HousingCardRow>): HousingCardRow => ({
  slug: 's', title: '어느 단지 예비입주자 모집', source: 'lh', kind: 'lh_rent', kind_detail: '국민임대', region_code: 'seoul', status: 'open',
  receipt_start: null, receipt_end: null, total_units: null, sp_newlywed_units: 0, sp_first_life_units: 0, sp_multi_child_units: 0, detail_url: null,
  ...over,
})

describe('카드 행에 자격 한 줄 붙이기', () => {
  it('유형의 요약을 싣는다', () => {
    const r = withEligibility(row({}))
    expect(r.eligibility_summary).toBe(ELIGIBILITY_GUIDES.national_rent!.summary)
    expect(r.eligibility_relaxed).toBe(false)
  })

  it('자격 완화 제목이면 relaxed', () => {
    expect(withEligibility(row({ title: '어느 단지 국민임대 입주자격 완화 상시모집' })).eligibility_relaxed).toBe(true)
  })

  it('안내가 없는 유형은 null이고 relaxed도 꺼진다', () => {
    const r = withEligibility(row({ kind_detail: '가정어린이집', title: '어느 단지 가정어린이집 선착순 모집' }))
    expect(r.eligibility_summary).toBeNull()
    expect(r.eligibility_relaxed).toBe(false)
  })

  // 분류는 되지만 안내를 싣지 않은 유형(집주인 임대주택).
  it('분류만 되고 안내가 없는 유형도 null', () => {
    expect(ELIGIBILITY_GUIDES.landlord_rent).toBeUndefined()
    const r = withEligibility(row({ kind_detail: '집주인임대', title: '어느 집주인 임대주택 선착순 모집' }))
    expect(r.eligibility_summary).toBeNull()
    expect(r.eligibility_relaxed).toBe(false)
  })

  it('원래 열은 그대로 둔다', () => {
    const src = row({ slug: 'abc', total_units: 10 })
    expect(withEligibility(src)).toMatchObject(src)
  })
})
