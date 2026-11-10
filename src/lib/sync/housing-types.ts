import type { SyncRunRow } from '../../types/database'
import type { HousingNoticeRow, HousingSource, HousingStatus, HousingUnitTypeInput } from '../../types/housing'

export interface HousingExisting {
  id: string
  slug: string
  content_hash: string
  status: HousingStatus
  /** 직전 저장된 특별공급 집계. 주택형 조회가 실패한 실행에서 0으로 덮지 않으려고 읽는다. */
  sp_newlywed_units: number
  sp_first_life_units: number
  sp_multi_child_units: number
}

/** 동기화가 필요로 하는 저장소 동작. Supabase 구현은 housing-repo.ts, 테스트는 가짜 객체. */
export interface HousingRepo {
  /** source별 기존 행: source_id → {id, slug, content_hash, status, sp_* 집계} */
  getExisting(source: HousingSource): Promise<Map<string, HousingExisting>>
  /** housing_notices 전체 슬러그(unique 제약이 source를 가리지 않는다) */
  allSlugs(): Promise<Set<string>>
  /** (source, source_id) 기준 upsert. source_id → id */
  upsertNotices(rows: HousingNoticeRow[]): Promise<Map<string, string>>
  /** 공고의 주택형을 통째로 바꾼다(삭제 후 삽입). 빈 배열이면 삭제만. */
  replaceUnitTypes(noticeId: string, rows: HousingUnitTypeInput[]): Promise<void>
  /** source 안에서 keep에 없는 source_id를 removed로. 바뀐 slug 반환. 호출 전에 fetched 0건·급감 가드를 통과해야 한다 — keep가 비면 그 source 전체가 removed가 된다. */
  markRemoved(source: HousingSource, keepSourceIds: string[]): Promise<string[]>
  recordRun(run: SyncRunRow): Promise<void>
  lastSuccessfulFetched(source: string): Promise<number | null>
}

export interface HousingSourceResult {
  source: HousingSource
  fetched: number
  changed: number
  upserted: number
  skipped: number
  /** 주택형 조회·저장 실패 건수. 조회 실패 공고는 빈 해시(직전 집계 유지)로 넣어 다음 실행이 다시 시도한다. 시간 예산 초과는 세지 않는다. */
  failed: number
  removed: number
  aborted_reason: string | null
  /** 이 소스가 예외로 끝났으면 메시지. 다른 소스는 계속 돈다. */
  error: string | null
  changedSlugs: string[]
  removedSlugs: string[]
}

export interface HousingSyncResult {
  applyhome: HousingSourceResult
  lh: HousingSourceResult
}
