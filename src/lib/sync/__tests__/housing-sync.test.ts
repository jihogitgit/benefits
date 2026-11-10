import { describe, it, expect, vi } from 'vitest'
import { runHousingSync } from '../housing-sync'
import type { HousingRepo, HousingExisting } from '../housing-types'
import type { HousingNoticeRow, HousingSource, HousingUnitTypeInput } from '@/types/housing'
import type { SyncRunRow } from '@/types/database'
import type { AptDetailItem, MdlItem } from '@/lib/api/applyhome-schema'
import type { LhNoticeItem } from '@/lib/api/lh-schema'
import { contentHash } from '../housing-normalize'

const now = new Date('2026-01-20T03:00:00Z')

function apt(id: string, over: Partial<AptDetailItem> = {}): AptDetailItem {
  return {
    HOUSE_MANAGE_NO: id, PBLANC_NO: id, HOUSE_NM: `단지 ${id}`, HOUSE_SECD: '01', HOUSE_SECD_NM: 'APT', HOUSE_DTL_SECD: '01', HOUSE_DTL_SECD_NM: '민영', RENT_SECD: '0', RENT_SECD_NM: '분양주택',
    SUBSCRPT_AREA_CODE: '100', SUBSCRPT_AREA_CODE_NM: '서울', HSSPLY_ZIP: null, HSSPLY_ADRES: null, TOT_SUPLY_HSHLDCO: '100', RCRIT_PBLANC_DE: '2026-01-10', PRZWNER_PRESNATN_DE: null,
    CNTRCT_CNCLS_BGNDE: null, CNTRCT_CNCLS_ENDDE: null, MVN_PREARNGE_YM: null, BSNS_MBY_NM: null, CNSTRCT_ENTRPS_NM: null, MDHS_TELNO: null, HMPG_ADRES: null, PBLANC_URL: null, NSPRC_NM: null,
    SPECLT_RDN_EARTH_AT: null, MDAT_TRGET_AREA_SECD: null, PARCPRC_ULS_AT: null, PUBLIC_HOUSE_EARTH_AT: null, LRSCL_BLDLND_AT: null, NPLN_PRVOPR_PUBLIC_HOUSE_AT: null, IMPRMN_BSNS_AT: null,
    SPSPLY_RCEPT_BGNDE: '2026-01-25', SPSPLY_RCEPT_ENDDE: '2026-01-25', RCEPT_BGNDE: '2026-01-25', RCEPT_ENDDE: '2026-01-27',
    GNRL_RNK1_CRSPAREA_RCPTDE: null, GNRL_RNK1_CRSPAREA_ENDDE: null,
    GNRL_RNK1_ETC_GG_RCPTDE: null, GNRL_RNK1_ETC_GG_ENDDE: null,
    GNRL_RNK1_ETC_AREA_RCPTDE: null, GNRL_RNK1_ETC_AREA_ENDDE: null,
    GNRL_RNK2_CRSPAREA_RCPTDE: null, GNRL_RNK2_CRSPAREA_ENDDE: null,
    GNRL_RNK2_ETC_GG_RCPTDE: null, GNRL_RNK2_ETC_GG_ENDDE: null,
    GNRL_RNK2_ETC_AREA_RCPTDE: null, GNRL_RNK2_ETC_AREA_ENDDE: null,
    ...over,
  }
}

function lh(id: string, over: Partial<LhNoticeItem> = {}): LhNoticeItem {
  return { PAN_ID: id, PAN_NM: `LH 공고 ${id}`, UPP_AIS_TP_CD: '06', UPP_AIS_TP_NM: '임대주택', AIS_TP_CD: null, AIS_TP_CD_NM: '행복주택', CNP_CD: null, CNP_CD_NM: '경기도', PAN_SS: '접수중', PAN_NT_ST_DT: null, CLSG_DT: null, DTL_URL: 'https://apply.lh.or.kr/x', ALL_CNT: '1', RNUM: '1', ...over }
}

const mdl = (id: string): MdlItem => ({ HOUSE_MANAGE_NO: id, PBLANC_NO: id, MODEL_NO: '1', HOUSE_TY: '084A', SUPLY_AR: '84', LTTOT_TOP_AMOUNT: '90000', SUPLY_HSHLDCO: '50', SPSPLY_HSHLDCO: '50', NWWDS_HSHLDCO: '10', LFE_FRST_HSHLDCO: null, MNYCH_HSHLDCO: null, OLD_PARNTS_SUPORT_HSHLDCO: null, INSTT_RECOMEND_HSHLDCO: null, TRANSR_INSTT_ENFSN_HSHLDCO: null, ETC_HSHLDCO: null, NWBB_HSHLDCO: null, YGMN_HSHLDCO: null })

function fakeRepo(existing: { applyhome?: Record<string, HousingExisting>; lh?: Record<string, HousingExisting> } = {}, lastFetched: Record<string, number | null> = {}) {
  const calls = { notices: [] as HousingNoticeRow[], units: [] as { noticeId: string; rows: HousingUnitTypeInput[] }[], runs: [] as SyncRunRow[], removedKeep: {} as Record<string, string[]> }
  const repo: HousingRepo = {
    getExisting: vi.fn(async (source: HousingSource) => new Map<string, HousingExisting>(Object.entries(existing[source] ?? {}))),
    allSlugs: vi.fn(async () => new Set([...Object.values(existing.applyhome ?? {}), ...Object.values(existing.lh ?? {})].map((e) => e.slug))),
    upsertNotices: vi.fn(async (rows: HousingNoticeRow[]) => {
      calls.notices.push(...rows)
      return new Map<string, string>(rows.map((r) => [r.source_id, `id-${r.source_id}`]))
    }),
    replaceUnitTypes: vi.fn(async (noticeId: string, rows: HousingUnitTypeInput[]) => {
      calls.units.push({ noticeId, rows })
    }),
    markRemoved: vi.fn(async (source: HousingSource, keep: string[]) => {
      calls.removedKeep[source] = keep
      return source === 'applyhome' ? ['removed-a'] : []
    }),
    recordRun: vi.fn(async (run: SyncRunRow) => {
      calls.runs.push(run)
    }),
    lastSuccessfulFetched: vi.fn(async (source: string) => lastFetched[source] ?? null),
  }
  return { repo, calls }
}

const deps = (repo: HousingRepo, over: Partial<Parameters<typeof runHousingSync>[0]> = {}) => ({
  repo,
  fetchApplyhome: async () => ({ apt: [apt('A1')], remainder: [], urbty: [] }),
  fetchUnits: vi.fn(async (_k: 'apt' | 'remainder', id: string) => [mdl(id)]),
  fetchLh: async () => [lh('L1')],
  now,
  ...over,
})

describe('runHousingSync', () => {
  it('신규 공고를 upsert하고 APT는 주택형을 받아 붙인다', async () => {
    const { repo, calls } = fakeRepo()
    const d = deps(repo)
    const r = await runHousingSync(d)
    expect(r.applyhome).toMatchObject({ fetched: 1, changed: 1, upserted: 1, skipped: 0, error: null })
    expect(r.lh).toMatchObject({ fetched: 1, changed: 1, upserted: 1 })
    expect(d.fetchUnits).toHaveBeenCalledWith('apt', 'A1', 'A1')
    expect(calls.units[0]).toMatchObject({ noticeId: 'id-A1:A1', rows: [{ house_type: '084A', sp_newlywed: 10 }] })
    const row = calls.notices.find((n) => n.source_id === 'A1:A1')!
    expect(row.sp_newlywed_units).toBe(10)
    expect(row.slug).toBe('단지-A1')
    expect(r.applyhome.changedSlugs).toEqual(['단지-A1'])
  })

  // 원천에 수정 시각이 없어 해시로 감지한다. 같은 해시·같은 상태면 주택형 호출도 하지 않는다.
  it('해시와 상태가 같으면 건너뛰고 주택형을 받지 않는다', async () => {
    const item = apt('A1')
    const { repo, calls } = fakeRepo({ applyhome: { 'A1:A1': { id: 'x', slug: '단지-A1', content_hash: contentHash(item), status: 'upcoming' } } })
    const d = deps(repo, { fetchApplyhome: async () => ({ apt: [item], remainder: [], urbty: [] }) })
    const r = await runHousingSync(d)
    expect(r.applyhome.skipped).toBe(1)
    expect(r.applyhome.changed).toBe(0)
    expect(d.fetchUnits).not.toHaveBeenCalled()
    expect(calls.notices.filter((n) => n.source === 'applyhome')).toHaveLength(0)
  })

  // 접수 시작일이 지나면 원문은 그대로여도 상태가 바뀐다. 이것을 놓치면 "접수 예정"이 영영 남는다.
  it('해시가 같아도 날짜로 계산한 상태가 다르면 갱신하고 기존 slug를 유지한다', async () => {
    const item = apt('A1')
    const { repo, calls } = fakeRepo({ applyhome: { 'A1:A1': { id: 'x', slug: '옛-슬러그', content_hash: contentHash(item), status: 'upcoming' } } })
    const later = new Date('2026-01-26T03:00:00Z') // 접수 구간 안
    const r = await runHousingSync(deps(repo, { fetchApplyhome: async () => ({ apt: [item], remainder: [], urbty: [] }), now: later }))
    expect(r.applyhome.changed).toBe(1)
    expect(calls.notices[0]).toMatchObject({ slug: '옛-슬러그', status: 'open' })
  })

  it('LH는 대상 밖 유형(토지)을 세지 않고 주택형도 받지 않는다', async () => {
    const { repo, calls } = fakeRepo()
    const d = deps(repo, { fetchLh: async () => [lh('L1'), lh('L2', { UPP_AIS_TP_CD: '01' })] })
    const r = await runHousingSync(d)
    expect(r.lh.fetched).toBe(2)
    expect(r.lh.changed).toBe(1)
    expect(calls.notices.filter((n) => n.source === 'lh')).toHaveLength(1)
    expect(calls.units.every((u) => !u.noticeId.startsWith('id-L'))).toBe(true)
  })

  it('한 소스가 던져도 다른 소스는 끝까지 돌고 run에 error를 남긴다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repo, calls } = fakeRepo()
    const r = await runHousingSync(deps(repo, { fetchApplyhome: async () => { throw new Error('odcloud 500') } }))
    expect(r.applyhome.error).toContain('odcloud 500')
    expect(r.lh).toMatchObject({ upserted: 1, error: null })
    expect(calls.runs.map((x) => [x.source, x.error])).toEqual([['applyhome', 'odcloud 500'], ['lh', null]])
  })

  it('직전 성공 대비 30% 넘게 줄면 그 소스만 중단한다', async () => {
    const { repo, calls } = fakeRepo({}, { lh: 10 })
    const r = await runHousingSync(deps(repo))
    expect(r.lh.aborted_reason).toMatch(/급감/)
    expect(r.lh.upserted).toBe(0)
    expect(r.applyhome.upserted).toBe(1)
    expect(calls.runs.find((x) => x.source === 'lh')?.aborted_reason).toMatch(/급감/)
  })

  it('원천에서 사라진 공고는 removed로 표시하고 slug를 돌려준다', async () => {
    const { repo, calls } = fakeRepo()
    const r = await runHousingSync(deps(repo))
    expect(calls.removedKeep.applyhome).toEqual(['A1:A1'])
    expect(calls.removedKeep.lh).toEqual(['L1'])
    expect(r.applyhome.removedSlugs).toEqual(['removed-a'])
    expect(r.applyhome.removed).toBe(1)
  })

  it('같은 제목의 공고는 슬러그에 접미를 붙인다', async () => {
    const { repo, calls } = fakeRepo()
    await runHousingSync(deps(repo, { fetchApplyhome: async () => ({ apt: [apt('A1', { HOUSE_NM: '같은 이름' }), apt('A2', { HOUSE_NM: '같은 이름' })], remainder: [], urbty: [] }) }))
    const slugs = calls.notices.filter((n) => n.source === 'applyhome').map((n) => n.slug).sort()
    expect(slugs).toEqual(['같은-이름', '같은-이름-2'])
  })

  // 주택형 조회 실패는 그 공고만 건너뛴다. 해시가 저장되지 않으므로 다음 실행이 다시 시도한다.
  it('주택형 조회가 실패한 공고는 upsert하지 않고 failed로 센다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repo, calls } = fakeRepo()
    const fetchUnits = vi.fn(async (_k: 'apt' | 'remainder', id: string) => { if (id === 'A2') throw new Error('mdl 500'); return [mdl(id)] })
    const r = await runHousingSync(deps(repo, { fetchApplyhome: async () => ({ apt: [apt('A1'), apt('A2')], remainder: [], urbty: [] }), fetchUnits }))
    expect(r.applyhome).toMatchObject({ changed: 2, upserted: 1, failed: 1, error: null })
    expect(calls.notices.filter((n) => n.source === 'applyhome').map((n) => n.source_id)).toEqual(['A1:A1'])
    expect(calls.runs.find((x) => x.source === 'applyhome')?.failed).toBe(1)
  })
})
