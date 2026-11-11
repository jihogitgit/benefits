import { describe, it, expect } from 'vitest'
import { resolveEligibility, type EligibilityInput } from '../eligibility-type'

const lh = (kind_detail: string, title: string, kind: EligibilityInput['kind'] = 'lh_rent'): EligibilityInput => ({ source: 'lh', kind, kind_detail, title })
const ah = (kind: EligibilityInput['kind'], kind_detail: string | null, title = '어느 단지'): EligibilityInput => ({ source: 'applyhome', kind, kind_detail, title })
const key = (n: EligibilityInput) => resolveEligibility(n)?.key ?? null

describe('자격 유형 분류', () => {
  it.each([
    ['국민임대', 'national_rent'],
    ['영구임대', 'permanent_rent'],
    ['행복주택', 'happy_house'],
    ['통합공공임대', 'integrated_rent'],
    ['전세임대', 'jeonse_rent'],
    ['집주인임대', 'landlord_rent'],
    ['공공분양(신혼희망)', 'newlywed_town_sale'],
    ['행복주택(신혼희망)', 'newlywed_town_rent'],
  ])('LH %s → %s', (detail, expected) => {
    expect(key(lh(detail, '어느 단지 입주자 모집'))).toBe(expected)
  })

  // 실제 제목(2026-11-11 적재분)에서 뽑았다.
  it.each([
    ['[경남지역본부]26년 3차 신혼·신생아매입임대Ⅰ 예비입주자 모집공고', 'purchase_newlywed'],
    ['[부산울산]신혼부부Ⅱ(전세형) 매입임대주택 예비입주자 모집공고', 'purchase_newlywed'],
    ['[인천지역본부] 26년 4차 청년 매입임대주택 예비입주자 모집공고(인천,부천)', 'purchase_youth'],
    ['[경남지역본부]26년 4차 비분양전환형 든든전세주택 입주자 모집 공고', 'purchase_dundun'],
    ['[정정공고][청년신혼부부매입임대리츠]_강원지역 입주자 모집', 'purchase_reit'],
    ['[제주지역본부] 일반 매입임대주택 예비입주자 모집공고(서귀포시)', 'purchase_general'],
    ['광주전남 기존주택 등 매입임대주택 예비입주자 모집 공고', 'purchase_general'],
    ['경북북부권(안동,영주) 다가구 등 매입임대주택 입주자 모집', 'purchase_general'],
    ['청주시 다자녀 매입임대주택 예비입주자 모집(261029공고)', 'purchase_multichild'],
    ['전북특별자치도 김제시 고령자 매입임대주택 예비입주자 모집 공고', 'purchase_senior'],
    ['강릉시 매입임대주택 예비입주자 모집', 'purchase_overview'],
    ['부천시 취·창업 청년 지원 주택 예비입주자 모집공고', 'purchase_youth'],
  ])('매입임대 "%s" → %s', (title, expected) => {
    expect(key(lh('매입임대', title, 'lh_welfare'))).toBe(expected)
  })

  it('매입임대 운영기관 모집은 입주 자격 안내 대상이 아니다', () => {
    expect(key(lh('매입임대', '하반기 매입임대 공동생활가정 운영기관 모집공고', 'lh_welfare'))).toBeNull()
  })

  it.each([
    ['남원노암 공공임대 50년 예비입주자 모집', 'public_rent_50'],
    ['광주동림2 - 50년 공공임대주택 예비입주자 모집공고', 'public_rent_50'],
    ['시흥시 10년 공공임대주택 예비입주자 모집공고', 'public_rent_convertible'],
    ['화성동탄2 10년 분양전환공공임대주택(리츠) 예비입주자모집공고', 'public_rent_convertible'],
    ['어느 단지 공공임대 예비입주자 모집', null],
  ])('공공임대 "%s" → %s', (title, expected) => {
    expect(key(lh('공공임대', title))).toBe(expected)
  })

  it('6년 공공임대주택은 분양전환 유형이다', () => {
    expect(key(lh('6년 공공임대주택', '군포대야미 A-1블록 입주자모집공고'))).toBe('public_rent_convertible')
  })

  it.each([
    ['고양창릉 S-4블록 공공분양주택 입주자모집공고', 'public_sale'],
    ['[정정공고]시흥거모 S-1블록 공공분양주택 입주자모집공고', 'public_sale'],
    ['고양지축 B-1블록 공공분양주택 잔여세대 추가입주자모집공고', 'lh_sale_leftover'],
    ['경기남부권(수원·용인 광교) 공가세대 일반매각 공고(무순위, 유주택자 가능)', 'lh_sale_leftover'],
    ['[선착순 동·호지정] 영천문외 센트럴타운 공공분양주택 추가입주자 모집 공고', 'lh_sale_leftover'],
    ['대전대동2 1BL 공공분양 추가 입주자모집공고[계약금 정액제(천만원), 순번추첨동호지정]', 'lh_sale_leftover'],
    ['경산진량우림필유 미분양매입 잔여세대 선착순 일반매각 공고', 'lh_sale_leftover'],
  ])('LH 분양주택 "%s" → %s', (title, expected) => {
    expect(key(lh('분양주택', title, 'lh_sale'))).toBe(expected)
  })

  it.each([
    [ah('apt', '민영'), 'private_sale'],
    [ah('apt', '국민'), 'public_sale'],
    [ah('newlywed_town', '국민'), 'newlywed_town_sale'],
    [ah('apt_remainder', '무순위'), 'remainder'],
    [ah('apt_remainder', '불법행위 재공급'), 'resupply'],
    [ah('officetel_etc', '오피스텔'), 'officetel'],
    [ah('officetel_etc', '도시형생활주택'), 'urban_house'],
    [ah('officetel_etc', '민간임대'), 'private_rent'],
  ])('청약홈 %o → %s', (n, expected) => {
    expect(key(n)).toBe(expected)
  })

  it.each([
    lh('가정어린이집', '어느 단지 가정어린이집 임차인 모집'),
    lh('처음 보는 유형', '어느 공고'),
    lh('', '어느 공고'),
    ah('apt', null),
    ah('apt', '처음 보는 구분'),
    ah('apt_remainder', '임의공급'),
  ])('모르는 구분은 null: %o', (n) => {
    expect(resolveEligibility(n)).toBeNull()
  })

  describe('자격 완화 표시', () => {
    it('임대 제목의 입주자격완화·상시모집·선착순은 relaxed', () => {
      expect(resolveEligibility(lh('매입임대', '충남당진 송산청광플러스원 청년 입주자격완화 상시모집', 'lh_welfare'))?.relaxed).toBe(true)
      expect(resolveEligibility(lh('국민임대', '어느 단지 국민임대 선착순 모집'))?.relaxed).toBe(true)
    })
    it('보통 공고는 relaxed가 아니다', () => {
      expect(resolveEligibility(lh('국민임대', '어느 단지 국민임대 예비입주자 모집'))?.relaxed).toBe(false)
    })
    it('잔여세대 분양은 유형 자체가 완화라 표시를 따로 달지 않는다', () => {
      expect(resolveEligibility(lh('분양주택', '어느 단지 잔여세대 선착순 일반매각', 'lh_sale'))).toEqual({ key: 'lh_sale_leftover', relaxed: false })
    })
    it('청약홈 공고는 제목으로 완화를 판단하지 않는다', () => {
      expect(resolveEligibility(ah('apt', '민영', '선착순 분양 단지'))?.relaxed).toBe(false)
    })
  })
})
