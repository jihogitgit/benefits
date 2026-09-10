import type { BenefitRow, ConditionRow, SyncRunRow } from '../../types/database'

export interface ExistingVersion {
  id: string
  slug: string
  source_updated_at: string | null
}

/** 동기화가 필요로 하는 저장소 동작. Supabase 구현은 supabase-repo.ts, 테스트는 가짜 객체. */
export interface BenefitsRepo {
  /** source별 기존 행: source_id → {id, slug, source_updated_at} */
  getExisting(source: string): Promise<Map<string, ExistingVersion>>
  /** (source, source_id) 기준 upsert. source_id → id 맵을 돌려준다. */
  upsertBenefits(rows: BenefitRow[]): Promise<Map<string, string>>
  upsertConditions(rows: ConditionRow[]): Promise<void>
  /** period 마감이 지난 open 행을 closed로. 바뀐 수 반환 */
  closeExpired(todayKst: string): Promise<number>
  /** source 안에서 keep에 없는 source_id를 removed로. 바뀐 수 반환 */
  markRemoved(source: string, keepSourceIds: string[]): Promise<number>
  recordRun(run: SyncRunRow): Promise<void>
  lastSuccessfulFetched(source: string): Promise<number | null>
}

export interface SyncResult {
  fetched: number
  changed: number
  upserted: number
  skipped: number
  failed: number
  closed: number
  removed: number
  aborted_reason: string | null
  changedSlugs: string[]
  changedSegments: string[]
}
