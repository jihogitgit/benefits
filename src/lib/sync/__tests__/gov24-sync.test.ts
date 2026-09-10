import { describe, it, expect, vi } from 'vitest'
import { runGov24Sync } from '../gov24-sync'
import type { BenefitsRepo, ExistingVersion } from '../types'
import type { ServiceListItem, SupportConditionItem } from '@/lib/api/gov24-schema'
import type { BenefitRow, ConditionRow, SyncRunRow } from '@/types/database'

function item(id: string, title: string, updated: string | null, extra: Partial<ServiceListItem> = {}): ServiceListItem {
  return {
    서비스ID: id,
    서비스명: title,
    서비스목적요약: null,
    서비스분야: null,
    선정기준: null,
    지원내용: null,
    지원대상: null,
    지원유형: null,
    신청기한: '상시',
    신청방법: null,
    접수기관: null,
    소관기관명: '보건복지부',
    소관기관유형: null,
    부서명: null,
    전화문의: null,
    상세조회URL: null,
    사용자구분: null,
    등록일시: '20240101000000',
    수정일시: updated,
    ...extra,
  }
}

function fakeRepo(existing: Record<string, ExistingVersion> = {}, lastFetched: number | null = null) {
  const calls = { benefits: [] as BenefitRow[], conditions: [] as ConditionRow[], runs: [] as SyncRunRow[], removedKeep: [] as string[] }
  const repo: BenefitsRepo = {
    getExisting: vi.fn(async () => new Map(Object.entries(existing))),
    upsertBenefits: vi.fn(async (rows: BenefitRow[]) => {
      calls.benefits.push(...rows)
      return new Map(rows.map((r) => [r.source_id, `id-${r.source_id}`]))
    }),
    upsertConditions: vi.fn(async (rows: ConditionRow[]) => {
      calls.conditions.push(...rows)
    }),
    closeExpired: vi.fn(async () => 2),
    markRemoved: vi.fn(async (_s: string, keep: string[]) => {
      calls.removedKeep = keep
      return 1
    }),
    recordRun: vi.fn(async (run: SyncRunRow) => {
      calls.runs.push(run)
    }),
    lastSuccessfulFetched: vi.fn(async () => lastFetched),
  }
  return { repo, calls }
}

const now = new Date('2026-09-10T03:00:00Z')

describe('runGov24Sync', () => {
  it('신규·변경 항목만 upsert하고 조건을 붙인다', async () => {
    const { repo, calls } = fakeRepo({
      A: { id: 'id-A', slug: 'a', source_updated_at: '2026-01-01T00:00:00.000Z' },
    })
    const list = [
      item('A', '기존 그대로', '20260101090000'), // KST 09:00 = UTC 00:00 → 동일
      item('B', '청년 월세 지원', '20260201090000'), // 신규
    ]
    const conds: SupportConditionItem[] = [{ 서비스ID: 'B', JA0110: 19, JA0111: 34 }]

    const result = await runGov24Sync({ repo, fetchList: async () => list, fetchConditions: async () => conds, now })

    expect(result.fetched).toBe(2)
    expect(result.changed).toBe(1)
    expect(result.upserted).toBe(1)
    expect(result.skipped).toBe(1)
    expect(calls.benefits.map((b) => b.source_id)).toEqual(['B'])
    expect(calls.benefits[0].segments).toEqual(['youth'])
    expect(calls.conditions[0]).toMatchObject({ benefit_id: 'id-B', age_min: 19, age_max: 34, region_codes: [] })
    expect(result.changedSlugs).toEqual(['청년-월세-지원'])
    expect(result.changedSegments).toEqual(['youth'])
    expect([...calls.removedKeep].sort()).toEqual(['A', 'B'])
    expect(result.closed).toBe(2)
    expect(result.removed).toBe(1)
    expect(calls.runs[0]).toMatchObject({ source: 'gov24', fetched: 2, upserted: 1, skipped: 1, error: null })
    expect(calls.runs[0].finished_at).not.toBeNull()
  })

  it('force면 수정일시가 같아도 다시 upsert한다', async () => {
    const { repo, calls } = fakeRepo({ A: { id: 'id-A', slug: 'a', source_updated_at: '2026-01-01T00:00:00.000Z' } })
    const result = await runGov24Sync({ repo, fetchList: async () => [item('A', '기존', '20260101090000')], fetchConditions: async () => [], now, force: true })
    expect(result.upserted).toBe(1)
    expect(calls.benefits[0].slug).toBe('a')
  })

  it('기존 slug를 유지하고 신규 slug 충돌은 접미로 해소한다', async () => {
    const { repo, calls } = fakeRepo({
      A: { id: 'id-A', slug: '청년-지원', source_updated_at: null },
    })
    const list = [item('A', '청년 지원', '20260201090000'), item('B', '청년 지원', '20260201090000')]
    await runGov24Sync({ repo, fetchList: async () => list, fetchConditions: async () => [], now })
    const slugs = Object.fromEntries(calls.benefits.map((b) => [b.source_id, b.slug]))
    expect(slugs.A).toBe('청년-지원')
    expect(slugs.B).toBe('청년-지원-2')
  })

  it('30% 급감이면 upsert 없이 중단 기록', async () => {
    const { repo, calls } = fakeRepo({}, 100)
    const result = await runGov24Sync({
      repo,
      fetchList: async () => [item('A', 'x', '20260201090000')],
      fetchConditions: async () => [],
      now,
    })
    expect(result.aborted_reason).toMatch(/급감/)
    expect(calls.benefits).toHaveLength(0)
    expect(repo.markRemoved).not.toHaveBeenCalled()
    expect(calls.runs[0].aborted_reason).toMatch(/급감/)
  })

  it('필수 필드가 깨진 항목은 건너뛰고 failed에 기록', async () => {
    const { repo, calls } = fakeRepo()
    const bad = item('C', '   ', '20260201090000')
    const result = await runGov24Sync({
      repo,
      fetchList: async () => [bad, item('D', '정상', '20260201090000')],
      fetchConditions: async () => [],
      now,
    })
    expect(result.failed).toBe(1)
    expect(calls.benefits.map((b) => b.source_id)).toEqual(['D'])
  })

  it('지자체 항목의 조건에는 region_codes가 채워진다', async () => {
    const { repo, calls } = fakeRepo()
    const list = [item('E', '서울 청년수당', '20260201090000', { 소관기관명: '서울특별시' })]
    await runGov24Sync({ repo, fetchList: async () => list, fetchConditions: async () => [{ 서비스ID: 'E', JA0404: 'Y' }], now })
    expect(calls.conditions[0]).toMatchObject({ region_codes: ['seoul'], household_types: ['single'] })
  })

  it('Supabase 오류 객체도 읽을 수 있는 문자열로 기록한다', async () => {
    const { repo, calls } = fakeRepo()
    ;(repo.upsertBenefits as ReturnType<typeof vi.fn>).mockRejectedValueOnce({ code: '22008', message: 'date/time field value out of range', details: null })
    await expect(
      runGov24Sync({ repo, fetchList: async () => [item('A', 'x', '20260201090000')], fetchConditions: async () => [], now }),
    ).rejects.toBeTruthy()
    expect(calls.runs[0].error).toBe('22008 date/time field value out of range')
  })

  it('fetch가 throw하면 run에 error를 남기고 다시 throw', async () => {
    const { repo, calls } = fakeRepo()
    await expect(
      runGov24Sync({
        repo,
        fetchList: async () => {
          throw new Error('HTTP 500')
        },
        fetchConditions: async () => [],
        now,
      }),
    ).rejects.toThrow('HTTP 500')
    expect(calls.runs[0].error).toMatch(/HTTP 500/)
  })
})
