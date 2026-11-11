import { describe, it, expect } from 'vitest'
import { extractConditions } from '../conditions'

const keys = (raw: unknown) => extractConditions(raw).map((c) => c.key)

describe('규제 표시 추출', () => {
  it('Y인 표시만, 정해진 순서로 낸다', () => {
    expect(keys({ IMPRMN_BSNS_AT: 'Y', SPECLT_RDN_EARTH_AT: 'Y', PARCPRC_ULS_AT: 'N', MDAT_TRGET_AREA_SECD: 'N' })).toEqual(['speculation', 'redevelopment'])
  })

  it('전부 N이면 빈 배열', () => {
    expect(keys({ SPECLT_RDN_EARTH_AT: 'N', MDAT_TRGET_AREA_SECD: 'N', PARCPRC_ULS_AT: 'N', IMPRMN_BSNS_AT: 'N', PUBLIC_HOUSE_EARTH_AT: 'N', LRSCL_BLDLND_AT: 'N', NPLN_PRVOPR_PUBLIC_HOUSE_AT: 'N', PUBLIC_HOUSE_SPCLW_APPLC_AT: 'N' })).toEqual([])
  })

  it('필드가 없는 공고(LH·오피스텔)와 이상한 raw는 빈 배열', () => {
    expect(keys({ PAN_ID: '1', PAN_NM: '어느 공고' })).toEqual([])
    for (const raw of [null, undefined, 'x', 3, []]) expect(keys(raw)).toEqual([])
  })

  it("소문자·공백이 섞인 'y'도 읽고, Y가 아닌 값은 켜지 않는다", () => {
    expect(keys({ PARCPRC_ULS_AT: ' y ' })).toEqual(['price_cap'])
    expect(keys({ PARCPRC_ULS_AT: 'D', SPECLT_RDN_EARTH_AT: true, MDAT_TRGET_AREA_SECD: 1 })).toEqual([])
  })

  it('분양가상한제는 재당첨 10년과 거주의무를 말한다', () => {
    const [c] = extractConditions({ PARCPRC_ULS_AT: 'Y' })
    expect(c.label).toBe('분양가상한제')
    expect(c.effects.join(' ')).toMatch(/10년/)
    expect(c.effects.join(' ')).toMatch(/거주의무/)
  })

  it('투기과열지구는 10년, 청약과열지역은 7년', () => {
    expect(extractConditions({ SPECLT_RDN_EARTH_AT: 'Y' })[0].effects.join(' ')).toMatch(/10년/)
    expect(extractConditions({ MDAT_TRGET_AREA_SECD: 'Y' })[0].effects.join(' ')).toMatch(/7년/)
  })

  it('여러 표시가 같은 문장을 가지면 한 번만 낸다', () => {
    const [a, b] = extractConditions({ SPECLT_RDN_EARTH_AT: 'Y', MDAT_TRGET_AREA_SECD: 'Y' })
    expect(a.effects).toHaveLength(3)
    expect(b.effects).toEqual([]) // 1순위·전매 문장은 중복, 7년은 10년에 밀린다
  })

  // 재당첨 제한은 가장 긴 기간만 적용된다. 10년짜리가 켜져 있으면 7년을 말하지 않는다.
  it('분양가상한제(10년)와 청약과열지역(7년)이 함께면 7년 문장을 내지 않는다', () => {
    const all = extractConditions({ MDAT_TRGET_AREA_SECD: 'Y', PARCPRC_ULS_AT: 'Y' }).flatMap((c) => c.effects).join(' ')
    expect(all).toMatch(/10년/)
    expect(all).not.toMatch(/7년/)
  })

  it('청약과열지역만 켜져 있으면 7년을 말한다', () => {
    expect(extractConditions({ MDAT_TRGET_AREA_SECD: 'Y' }).flatMap((c) => c.effects).join(' ')).toMatch(/7년/)
  })

  it('정비사업·공공주택지구는 이름만 낸다(그 표시만으로 달라지는 조문이 없다)', () => {
    for (const c of extractConditions({ IMPRMN_BSNS_AT: 'Y', PUBLIC_HOUSE_EARTH_AT: 'Y' })) expect(c.effects).toEqual([])
  })
})
