import { describe, it, expect } from 'vitest'
import { aptDetailResponse, aptMdlResponse, urbtyDetailResponse } from '../applyhome-schema'

const envelope = (data: unknown[]) => ({ currentCount: data.length, matchCount: data.length, page: 1, perPage: 10, totalCount: data.length, data })

describe('청약홈 스키마', () => {
  it('APT 상세는 식별자 두 개가 필수이고 나머지는 비어도 된다', () => {
    const r = aptDetailResponse.parse(envelope([{ HOUSE_MANAGE_NO: 2026000001, PBLANC_NO: 2026000001, HOUSE_NM: '래미안 테스트', RCEPT_BGNDE: '2026-01-15', TOT_SUPLY_HSHLDCO: '320', SUBSCRPT_AREA_CODE_NM: '서울' }]))
    const item = r.data[0]
    expect(item.HOUSE_MANAGE_NO).toBe('2026000001') // 숫자가 와도 문자열로
    expect(item.TOT_SUPLY_HSHLDCO).toBe('320')
    expect(item.RCRIT_PBLANC_DE).toBeNull()
  })

  it('식별자가 없으면 거부한다', () => {
    expect(() => aptDetailResponse.parse(envelope([{ HOUSE_NM: '이름만' }]))).toThrow()
  })

  it('주택형 행은 특별공급 세부 세대수를 문자열로 받는다', () => {
    const r = aptMdlResponse.parse(envelope([{ HOUSE_MANAGE_NO: '1', PBLANC_NO: '1', HOUSE_TY: '084.9712A', SUPLY_AR: '84.97', LTTOT_TOP_AMOUNT: '98000', SUPLY_HSHLDCO: 100, SPSPLY_HSHLDCO: 50, NWWDS_HSHLDCO: 20 }]))
    expect(r.data[0].NWWDS_HSHLDCO).toBe('20')
    expect(r.data[0].LFE_FRST_HSHLDCO).toBeNull()
  })

  it('오피스텔 상세는 일반 접수일 필드를 쓴다', () => {
    const r = urbtyDetailResponse.parse(envelope([{ HOUSE_MANAGE_NO: '2', PBLANC_NO: '2', SUBSCRPT_RCEPT_BGNDE: '2026-02-01', SUBSCRPT_RCEPT_ENDDE: '2026-02-03' }]))
    expect(r.data[0].SUBSCRPT_RCEPT_BGNDE).toBe('2026-02-01')
  })
})
