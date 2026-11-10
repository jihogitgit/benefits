import { describe, it, expect } from 'vitest'
import { parseLhList } from '../lh-schema'

const row = { PAN_ID: '2026000123', PAN_NM: '행복주택 입주자 모집', UPP_AIS_TP_NM: '임대주택', AIS_TP_CD_NM: '행복주택', CNP_CD_NM: '서울특별시', PAN_SS: '접수중', DTL_URL: 'https://apply.lh.or.kr/x', ALL_CNT: '37', RNUM: '1' }

describe('LH 공고문 응답 파서', () => {
  it('배열 래퍼([resHeader, dsList])를 받는다', () => {
    const r = parseLhList([{ resHeader: [{ SS_CODE: 'Y', RS_DTTM: '20260110' }] }, { dsList: [row] }])
    expect(r.items).toHaveLength(1)
    expect(r.items[0].PAN_ID).toBe('2026000123')
    expect(r.total).toBe(37)
  })

  it('객체 래퍼({dsList})도 받는다', () => {
    const r = parseLhList({ dsList: [row] })
    expect(r.items[0].AIS_TP_CD_NM).toBe('행복주택')
  })

  it('dsList가 없으면 빈 목록이다(마지막 페이지 뒤)', () => {
    expect(parseLhList([{ resHeader: [{ SS_CODE: 'Y' }] }]).items).toEqual([])
  })

  it('PAN_ID가 없는 행은 거부한다', () => {
    expect(() => parseLhList({ dsList: [{ PAN_NM: '이름만' }] })).toThrow()
  })
})
