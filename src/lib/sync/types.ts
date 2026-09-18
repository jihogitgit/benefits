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
  /**
   * 테이블 전체의 슬러그. source로 좁히지 않는다 — benefits.slug의 unique 제약이
   * source를 가리지 않기 때문이다. gov24 슬러그만 보고 중복을 피하면, 손으로 채운 행이
   * 선점한 이름을 그대로 배정해 upsert 배치(최대 500건)가 통째로 실패한다.
   */
  allSlugs(): Promise<Set<string>>
  /** (source, source_id) 기준 upsert. source_id → id 맵을 돌려준다. */
  upsertBenefits(rows: BenefitRow[]): Promise<Map<string, string>>
  upsertConditions(rows: ConditionRow[]): Promise<void>
  /** period 마감이 지난 open 행을 closed로. 바뀐 수 반환 */
  /** 기한이 지난 행을 closed로. source로 좁힌다 — 다른 출처의 행을 이 동기화가 닫으면 안 된다. */
  closeExpired(source: string, todayKst: string): Promise<number>
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
