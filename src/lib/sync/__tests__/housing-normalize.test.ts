import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  toIsoDate,
  mapHousingRegion,
  computeHousingStatus,
  mapLhStatus,
  lhKind,
  aptKind,
  contentHash,
  housingSlugBase,
  aggregateUnits,
  normalizeApt,
  normalizeRemainder,
  normalizeUrbty,
  normalizeLh,
  unitsFromMdl,
} from '../housing-normalize'
import { aptDetailResponse } from '@/lib/api/applyhome-schema'
import type { AptDetailItem, MdlItem } from '@/lib/api/applyhome-schema'
import type { LhNoticeItem } from '@/lib/api/lh-schema'

const now = new Date('2026-01-20T03:00:00Z') // KST 2026-01-20 12:00

function apt(over: Partial<AptDetailItem> = {}): AptDetailItem {
  return {
    HOUSE_MANAGE_NO: '2026000001', PBLANC_NO: '2026000001', HOUSE_NM: '래미안 테스트', HOUSE_SECD: '01', HOUSE_SECD_NM: 'APT',
    HOUSE_DTL_SECD: '01', HOUSE_DTL_SECD_NM: '민영', RENT_SECD: '0', RENT_SECD_NM: '분양주택', SUBSCRPT_AREA_CODE: '100', SUBSCRPT_AREA_CODE_NM: '서울',
    HSSPLY_ZIP: null, HSSPLY_ADRES: '서울특별시 서초구 반포동 1-1', TOT_SUPLY_HSHLDCO: '320', RCRIT_PBLANC_DE: '2026-01-10', PRZWNER_PRESNATN_DE: '2026-01-28',
    CNTRCT_CNCLS_BGNDE: '2026-02-10', CNTRCT_CNCLS_ENDDE: '2026-02-12', MVN_PREARNGE_YM: '202812', BSNS_MBY_NM: '테스트건설', CNSTRCT_ENTRPS_NM: null, MDHS_TELNO: null,
    HMPG_ADRES: 'https://example.com', NSPRC_NM: null, PBLANC_URL: null, SPECLT_RDN_EARTH_AT: 'Y', MDAT_TRGET_AREA_SECD: 'Y', PARCPRC_ULS_AT: 'N', PUBLIC_HOUSE_EARTH_AT: 'N',
    LRSCL_BLDLND_AT: 'N', NPLN_PRVOPR_PUBLIC_HOUSE_AT: 'N', IMPRMN_BSNS_AT: 'N',
    SPSPLY_RCEPT_BGNDE: '2026-01-21', SPSPLY_RCEPT_ENDDE: '2026-01-21', RCEPT_BGNDE: '2026-01-21', RCEPT_ENDDE: '2026-01-23',
    GNRL_RNK1_CRSPAREA_RCPTDE: '2026-01-22', GNRL_RNK1_CRSPAREA_ENDDE: '2026-01-22',
    GNRL_RNK1_ETC_GG_RCPTDE: null, GNRL_RNK1_ETC_GG_ENDDE: null,
    GNRL_RNK1_ETC_AREA_RCPTDE: '2026-01-22', GNRL_RNK1_ETC_AREA_ENDDE: '2026-01-22',
    GNRL_RNK2_CRSPAREA_RCPTDE: '2026-01-23', GNRL_RNK2_CRSPAREA_ENDDE: '2026-01-23',
    GNRL_RNK2_ETC_GG_RCPTDE: null, GNRL_RNK2_ETC_GG_ENDDE: null,
    GNRL_RNK2_ETC_AREA_RCPTDE: null, GNRL_RNK2_ETC_AREA_ENDDE: null,
    ...over,
  }
}

function lh(over: Partial<LhNoticeItem> = {}): LhNoticeItem {
  return { PAN_ID: '2026000123', PAN_NM: '서울 행복주택 입주자 모집', UPP_AIS_TP_CD: '06', UPP_AIS_TP_NM: '임대주택', AIS_TP_CD: null, AIS_TP_CD_NM: '행복주택', CNP_CD: '11', CNP_CD_NM: '서울특별시', PAN_SS: '접수중', PAN_NT_ST_DT: '2026.01.15', CLSG_DT: '2026.02.15', DTL_URL: 'https://apply.lh.or.kr/x', ALL_CNT: '1', RNUM: '1', ...over }
}

describe('toIsoDate', () => {
  it.each([
    ['2026-01-15', '2026-01-15'],
    ['20260115', '2026-01-15'],
    ['2026.01.15', '2026-01-15'],
    ['2026-01-15 ~ 2026-01-16', '2026-01-15'], // 뒤에 뭐가 붙어도 앞 날짜
    ['', null],
    [null, null],
    ['미정', null],
  ])('%s → %s', (input, expected) => {
    expect(toIsoDate(input)).toBe(expected)
  })
})

describe('mapHousingRegion', () => {
  it.each([
    ['서울', 'seoul'],
    ['서울특별시', 'seoul'],
    ['경기도', 'gyeonggi'],
    ['전북특별자치도', 'jeonbuk'],
    ['전국', 'ALL'],
    ['해외', 'UNKNOWN'],
    [null, 'UNKNOWN'],
  ])('%s → %s', (input, expected) => {
    expect(mapHousingRegion(input)).toBe(expected)
  })
  // 긴 이름을 먼저 보지 않으면 "경기도 광주시"가 광주로 잡힌다(regions/extract.ts와 같은 이유).
  it('"경기도 광주시"는 경기다', () => {
    expect(mapHousingRegion('경기도 광주시')).toBe('gyeonggi')
  })
})

describe('computeHousingStatus', () => {
  it('접수 시작 전은 upcoming, 구간 안은 open, 지나면 closed', () => {
    expect(computeHousingStatus({ receipt_start: '2026-01-21', receipt_end: '2026-01-23' }, now)).toBe('upcoming')
    expect(computeHousingStatus({ receipt_start: '2026-01-20', receipt_end: '2026-01-23' }, now)).toBe('open')
    expect(computeHousingStatus({ receipt_start: '2026-01-10', receipt_end: '2026-01-19' }, now)).toBe('closed')
  })
  it('일정이 없으면 open(알 수 없음은 숨기지 않는다)', () => {
    expect(computeHousingStatus({ receipt_start: null, receipt_end: null }, now)).toBe('open')
  })
})

describe('mapLhStatus', () => {
  it.each([
    ['공고중', 'upcoming'],
    ['접수중', 'open'],
    ['정정공고중', 'open'],
    ['상담요청', 'open'],
    ['접수마감', 'closed'],
    [null, 'open'],
  ])('%s → %s', (input, expected) => {
    expect(mapLhStatus(input)).toBe(expected)
  })
})

describe('종류', () => {
  it('LH는 공고유형코드로', () => {
    expect(lhKind('05')).toBe('lh_sale')
    expect(lhKind('06')).toBe('lh_rent')
    expect(lhKind('13')).toBe('lh_welfare')
    expect(lhKind('39')).toBe('newlywed_town')
    expect(lhKind('01')).toBeNull() // 토지는 받지 않는다
  })
  it('청약홈 APT는 상세구분명에 신혼희망타운이 있으면 그쪽', () => {
    expect(aptKind(apt())).toBe('apt')
    expect(aptKind(apt({ HOUSE_DTL_SECD_NM: '신혼희망타운' }))).toBe('newlywed_town')
  })
  it('HOUSE_SECD 10(실측)이면 이름과 무관하게 신혼희망타운', () => {
    expect(aptKind(apt({ HOUSE_SECD: '10', HOUSE_SECD_NM: '신혼희망타운', HOUSE_DTL_SECD_NM: null }))).toBe('newlywed_town')
  })
})

describe('contentHash', () => {
  it('키 순서가 달라도 같은 내용이면 같다', () => {
    expect(contentHash({ a: 1, b: 'x' })).toBe(contentHash({ b: 'x', a: 1 }))
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }))
  })
})

describe('housingSlugBase', () => {
  it('제목을 slugify한다', () => {
    expect(housingSlugBase('래미안 원베일리 (민영)')).toBe('래미안-원베일리-민영')
  })
  // /housing/[slug]가 지역 목록과 공고 상세를 한 세그먼트에서 분기한다(설계 5절).
  it('지역 slug·page와 같아지면 접두사를 붙인다', () => {
    expect(housingSlugBase('seoul')).toBe('공고-seoul')
    expect(housingSlugBase('page')).toBe('공고-page')
  })
})

describe('주택형', () => {
  const mdl: MdlItem = { HOUSE_MANAGE_NO: '1', PBLANC_NO: '1', MODEL_NO: '1', HOUSE_TY: '084.9712A', SUPLY_AR: '84.97', LTTOT_TOP_AMOUNT: '98000', SUPLY_HSHLDCO: '100', SPSPLY_HSHLDCO: '50', NWWDS_HSHLDCO: '20', LFE_FRST_HSHLDCO: '10', MNYCH_HSHLDCO: '5', OLD_PARNTS_SUPORT_HSHLDCO: '3', INSTT_RECOMEND_HSHLDCO: '12', TRANSR_INSTT_ENFSN_HSHLDCO: null, ETC_HSHLDCO: null, NWBB_HSHLDCO: null, YGMN_HSHLDCO: null }
  it('문자열 숫자를 숫자로, 빈 값은 null로', () => {
    const [u] = unitsFromMdl([mdl])
    expect(u).toMatchObject({ house_type: '084.9712A', supply_area: 84.97, max_price_manwon: 98000, general_units: 100, special_units: 50, sp_newlywed: 20, sp_first_life: 10, sp_multi_child: 5, sp_old_parents: 3, sp_institution: 12, sp_etc: null })
  })
  it('공급면적은 소수 둘째 자리로 반올림한다(numeric(7,2))', () => {
    const [u] = unitsFromMdl([{ ...mdl, SUPLY_AR: '79.0470' }])
    expect(u.supply_area).toBe(79.05)
  })
  it('특별공급 합계를 낸다', () => {
    expect(aggregateUnits(unitsFromMdl([mdl, { ...mdl, HOUSE_TY: '059A', NWWDS_HSHLDCO: '5', LFE_FRST_HSHLDCO: null, MNYCH_HSHLDCO: '1' }]))).toEqual({ sp_newlywed_units: 25, sp_first_life_units: 10, sp_multi_child_units: 6 })
  })
  it('무순위처럼 특별공급 내역이 전부 null이면 합계는 0', () => {
    const bare: MdlItem = { ...mdl, SPSPLY_HSHLDCO: null, NWWDS_HSHLDCO: null, LFE_FRST_HSHLDCO: null, MNYCH_HSHLDCO: null, OLD_PARNTS_SUPORT_HSHLDCO: null, INSTT_RECOMEND_HSHLDCO: null }
    expect(aggregateUnits(unitsFromMdl([bare]))).toEqual({ sp_newlywed_units: 0, sp_first_life_units: 0, sp_multi_child_units: 0 })
  })
  it('주택형이 비면 null 행을 만들지 않는다', () => {
    expect(unitsFromMdl([{ ...mdl, HOUSE_TY: null }])).toEqual([])
  })
})

describe('normalizeApt', () => {
  it('일정 6종에서 접수 구간을 만들고 상태를 계산한다', () => {
    const row = normalizeApt(apt(), [], '래미안-테스트', now)
    expect(row).toMatchObject({
      source: 'applyhome', source_id: '2026000001:2026000001', slug: '래미안-테스트', title: '래미안 테스트', kind: 'apt', kind_detail: '민영',
      region_code: 'seoul', total_units: 320, notice_date: '2026-01-10', special_start: '2026-01-21', rank1_start: '2026-01-22', rank1_end: '2026-01-22',
      rank2_start: '2026-01-23', rank2_end: '2026-01-23', winner_date: '2026-01-28', contract_start: '2026-02-10', move_in_ym: '202812',
      receipt_start: '2026-01-21', receipt_end: '2026-01-23', status: 'upcoming', detail_url: 'https://example.com',
    })
    expect(row.content_hash).toHaveLength(40)
    expect(row.synced_at).toBe(now.toISOString())
  })
  it('주택형 합계를 행에 싣는다', () => {
    const units = [{ house_type: 'A', supply_area: null, max_price_manwon: null, general_units: null, special_units: null, sp_newlywed: 7, sp_first_life: null, sp_multi_child: 2, sp_old_parents: null, sp_institution: null, sp_etc: null }]
    const row = normalizeApt(apt(), units, 's', now)
    expect(row.sp_newlywed_units).toBe(7)
    expect(row.sp_multi_child_units).toBe(2)
    expect(row.sp_first_life_units).toBe(0)
  })
  it('해시는 synced_at·slug와 무관하다', () => {
    const a = normalizeApt(apt(), [], 'a', now)
    const b = normalizeApt(apt(), [], 'b', new Date('2027-01-01T00:00:00Z'))
    expect(a.content_hash).toBe(b.content_hash)
  })
})

describe('normalizeRemainder / normalizeUrbty', () => {
  it('무순위는 일반공급 접수일로 구간을 만든다', () => {
    const row = normalizeRemainder({ ...apt(), GNRL_RCEPT_BGNDE: '2026-01-25', GNRL_RCEPT_ENDDE: '2026-01-26', SUBSCRPT_RCEPT_BGNDE: null, SUBSCRPT_RCEPT_ENDDE: null } as never, [], 's', now)
    expect(row.kind).toBe('apt_remainder')
    expect(row.receipt_start).toBe('2026-01-21') // 특별공급이 더 이르다
    expect(row.receipt_end).toBe('2026-01-26')
  })
  it('실측처럼 GNRL이 null이고 SUBSCRPT에만 접수일이 있어도 같다', () => {
    const row = normalizeRemainder({ ...apt(), GNRL_RCEPT_BGNDE: null, GNRL_RCEPT_ENDDE: null, SUBSCRPT_RCEPT_BGNDE: '2026-01-25', SUBSCRPT_RCEPT_ENDDE: '2026-01-26' } as never, [], 's', now)
    expect(row.kind).toBe('apt_remainder')
    expect(row.receipt_start).toBe('2026-01-21')
    expect(row.receipt_end).toBe('2026-01-26')
  })
  it('오피스텔은 SUBSCRPT 접수일만 쓴다', () => {
    const row = normalizeUrbty({ ...apt(), SEARCH_HOUSE_SECD: '0201', SUBSCRPT_RCEPT_BGNDE: '2026-02-01', SUBSCRPT_RCEPT_ENDDE: '2026-02-03' } as never, 's', now)
    expect(row.kind).toBe('officetel_etc')
    expect(row.receipt_start).toBe('2026-02-01')
    expect(row.receipt_end).toBe('2026-02-03')
    expect(row.sp_newlywed_units).toBe(0)
  })
})

describe('normalizeLh', () => {
  it('유형·지역·상태·URL을 옮기고 일정은 비운다', () => {
    const row = normalizeLh(lh(), '서울-행복주택', now)
    expect(row).toMatchObject({ source: 'lh', source_id: '2026000123', kind: 'lh_rent', kind_detail: '행복주택', region_code: 'seoul', status: 'open', detail_url: 'https://apply.lh.or.kr/x', notice_date: '2026-01-15', receipt_start: null, receipt_end: null, total_units: null })
  })
  it('토지·상가 유형은 null을 돌려준다', () => {
    expect(normalizeLh(lh({ UPP_AIS_TP_CD: '01' }), 's', now)).toBeNull()
  })
})

describe('실측 fixture', () => {
  it('getAPTLttotPblancDetail 샘플 전 행이 정규화된다', () => {
    const json = JSON.parse(readFileSync(resolve(process.cwd(), 'fixtures/housing/getAPTLttotPblancDetail.sample.json'), 'utf8'))
    const rows = aptDetailResponse.parse(json).data
    expect(rows.length).toBeGreaterThan(0)
    for (const item of rows) {
      const row = normalizeApt(item, [], 's', now)
      expect(row.source_id).toBe(`${item.HOUSE_MANAGE_NO}:${item.PBLANC_NO}`)
      expect(row.region_code).not.toBe('UNKNOWN')
      expect(row.notice_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      if (row.receipt_start && row.receipt_end) expect(row.receipt_start <= row.receipt_end).toBe(true)
      expect(row.content_hash).toHaveLength(40)
      expect(['upcoming', 'open', 'closed']).toContain(row.status)
    }
  })
})
