import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { aptDetailResponse, aptMdlResponse, remainderDetailResponse, urbtyDetailResponse } from '../applyhome-schema'

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

const dir = join(process.cwd(), 'fixtures/housing')
const fixtures = [
  { file: 'getAPTLttotPblancDetail.sample.json', schema: aptDetailResponse, detail: true },
  { file: 'getRemndrLttotPblancDetail.sample.json', schema: remainderDetailResponse, detail: true },
  { file: 'getUrbtyOfctlLttotPblancDetail.sample.json', schema: urbtyDetailResponse, detail: true },
  { file: 'getAPTLttotPblancMdl.sample.json', schema: aptMdlResponse, detail: false, aptMdl: true },
  { file: 'getRemndrLttotPblancMdl.sample.json', schema: aptMdlResponse, detail: false },
]

describe('실측 픽스처', () => {
  it('픽스처가 하나 이상 있다', () => expect(fixtures.length).toBeGreaterThan(0))

  it.each(fixtures)('$file 전 행을 파싱한다', ({ file, schema, detail, aptMdl }) => {
    const json = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    const r = schema.parse(json) as { data: Record<string, string | null>[] }
    expect(r.data.length).toBe(json.data.length)
    if (aptMdl) expect(r.data[0].YGMN_HSHLDCO).not.toBeNull()
    for (const row of r.data) {
      expect(typeof row.HOUSE_MANAGE_NO).toBe('string')
      expect(row.HOUSE_MANAGE_NO).not.toBe('')
      expect(typeof row.PBLANC_NO).toBe('string')
      expect(row.PBLANC_NO).not.toBe('')
      if (!detail) expect(typeof row.SPSPLY_HSHLDCO).toBe('string')
      if (detail) {
        expect(row.RCRIT_PBLANC_DE).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        if (row.MVN_PREARNGE_YM !== null) expect(row.MVN_PREARNGE_YM).toMatch(/^\d{6}$/)
      }
    }
  })

  it('APT 상세의 1순위 해당지역 접수일은 문자열이다', () => {
    const json = JSON.parse(readFileSync(join(dir, 'getAPTLttotPblancDetail.sample.json'), 'utf8'))
    expect(typeof aptDetailResponse.parse(json).data[0].GNRL_RNK1_CRSPAREA_RCPTDE).toBe('string')
  })
})
