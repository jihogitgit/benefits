import { describe, it, expect } from 'vitest'
import { normalizeBenefit, kstToIso } from '../normalize'
import type { ServiceListItem } from '@/lib/api/gov24-schema'

const item: ServiceListItem = {
  서비스ID: 'SVC001',
  서비스명: '서울시 임산부 교통비 지원',
  서비스목적요약: '임산부 교통비 70만원 지원',
  서비스분야: '보육·교육',
  선정기준: '서울시 6개월 이상 거주 임산부',
  지원내용: '교통 포인트 70만원',
  지원대상: '임신 3개월 이상 임산부',
  지원유형: '현금',
  신청기한: '상시신청',
  신청방법: '온라인',
  접수기관: '서울맘케어',
  소관기관명: '서울특별시',
  소관기관유형: '지방자치단체',
  부서명: '출산정책팀',
  전화문의: '120',
  상세조회URL: 'https://www.gov.kr/portal/rcvfvrSvc/dtlEx/SVC001',
  사용자구분: '개인',
  등록일시: '20240101100000',
  수정일시: '20260901093000',
}

const cond = { age_min: 19, age_max: 45, life_stages: ['pregnancy'], household_types: [], occupations: [] }
const now = new Date('2026-09-10T03:00:00Z')

describe('kstToIso', () => {
  it('YYYYMMDDHHmmss (KST) → UTC ISO', () => {
    expect(kstToIso('20260901093000')).toBe('2026-09-01T00:30:00.000Z')
  })
  it('YYYY-MM-DD HH:mm:ss 형식도 받는다', () => {
    expect(kstToIso('2026-09-01 09:30:00')).toBe('2026-09-01T00:30:00.000Z')
  })
  it('빈 값·이상값은 null', () => {
    expect(kstToIso(null)).toBeNull()
    expect(kstToIso('상시')).toBeNull()
  })
})

describe('normalizeBenefit', () => {
  it('필드를 BenefitRow로 옮기고 파생값을 채운다', () => {
    const row = normalizeBenefit(item, cond, '서울시-임산부-교통비-지원', now)
    expect(row).toMatchObject({
      source: 'gov24',
      source_id: 'SVC001',
      slug: '서울시-임산부-교통비-지원',
      title: '서울시 임산부 교통비 지원',
      amount_text: '교통 포인트 70만원',
      target_text: '임신 3개월 이상 임산부',
      criteria_text: '서울시 6개월 이상 거주 임산부',
      apply_url: 'https://www.gov.kr/portal/rcvfvrSvc/dtlEx/SVC001',
      agency: '서울특별시',
      contact: '120',
      deadline_type: 'always',
      apply_end: null,
      region_code: 'seoul',
      segments: ['parenting'],
      status: 'open',
    })
    expect(row.source_updated_at).toBe('2026-09-01T00:30:00.000Z')
    expect(row.synced_at).toBe(now.toISOString())
  })
  it('수정일시가 없으면 등록일시를 쓴다', () => {
    const row = normalizeBenefit({ ...item, 수정일시: null }, cond, 's', now)
    expect(row.source_updated_at).toBe('2024-01-01T01:00:00.000Z') // KST 10:00 → UTC 01:00
  })
  it('조건이 없어도 텍스트로 세그먼트를 잡는다', () => {
    const row = normalizeBenefit(item, null, 's', now)
    expect(row.segments).toEqual(['parenting'])
  })
  it('기간이 지난 항목은 closed', () => {
    const row = normalizeBenefit({ ...item, 신청기한: '2026.01.01 ~ 2026.03.31' }, null, 's', now)
    expect(row.status).toBe('closed')
    expect(row.apply_end).toBe('2026-03-31')
  })
})
