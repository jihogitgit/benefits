import type { AptDetailItem, RemainderDetailItem, UrbtyDetailItem, MdlItem } from '@/lib/api/applyhome-schema'
import type { LhNoticeItem } from '@/lib/api/lh-schema'
import type { SyncRunRow } from '@/types/database'
import type { HousingNoticeRow, HousingSource, HousingUnitTypeInput } from '@/types/housing'
import { allocateSlug } from '@/lib/benefits/slug'
import { errorMessage } from './gov24-sync'
import { shouldAbortForDrop } from './diff'
import { housingSlugBase, normalizeApt, normalizeLh, normalizeRemainder, normalizeUrbty, unitsFromMdl } from './housing-normalize'
import type { HousingRepo, HousingSourceResult, HousingSyncResult } from './housing-types'

export interface HousingSyncDeps {
  repo: HousingRepo
  fetchApplyhome: () => Promise<{ apt: AptDetailItem[]; remainder: RemainderDetailItem[]; urbty: UrbtyDetailItem[] }>
  /** 바뀐 APT·무순위 공고의 주택형. 바뀌지 않은 공고에는 부르지 않는다. */
  fetchUnits: (kind: 'apt' | 'remainder', houseManageNo: string, pblancNo: string) => Promise<MdlItem[]>
  fetchLh: () => Promise<LhNoticeItem[]>
  now?: Date
  batchSize?: number
  log?: (msg: string) => void
}

function emptyResult(source: HousingSource): HousingSourceResult {
  return { source, fetched: 0, changed: 0, upserted: 0, skipped: 0, failed: 0, removed: 0, aborted_reason: null, error: null, changedSlugs: [], removedSlugs: [] }
}

/** 두 소스를 독립적으로 돌린다. 하나의 예외는 그 소스의 result.error와 sync_runs.error에만 남는다. */
export async function runHousingSync(deps: HousingSyncDeps): Promise<HousingSyncResult> {
  const now = deps.now ?? new Date()
  const applyhome = await runSource('applyhome', deps, now, syncApplyhome)
  const lh = await runSource('lh', deps, now, syncLh)
  return { applyhome, lh }
}

type SourceBody = (deps: HousingSyncDeps, now: Date, result: HousingSourceResult, log: (m: string) => void) => Promise<void>

async function runSource(source: HousingSource, deps: HousingSyncDeps, now: Date, body: SourceBody): Promise<HousingSourceResult> {
  const log = deps.log ?? (() => {})
  const result = emptyResult(source)
  const run: SyncRunRow = { source, started_at: now.toISOString(), finished_at: null, fetched: 0, upserted: 0, skipped: 0, failed: 0, closed: 0, removed: 0, error: null, aborted_reason: null }
  try {
    await body(deps, now, result, (m) => log(`[${source}] ${m}`))
  } catch (err) {
    result.error = errorMessage(err)
    console.error(`[housing-sync:${source}]`, err)
  } finally {
    run.fetched = result.fetched
    run.upserted = result.upserted
    run.skipped = result.skipped
    run.failed = result.failed
    run.removed = result.removed
    run.aborted_reason = result.aborted_reason
    run.error = result.error
    run.finished_at = new Date().toISOString()
    await deps.repo.recordRun(run)
  }
  return result
}

interface Candidate {
  row: HousingNoticeRow
  /** 주택형을 받아야 하는 청약홈 공고(APT·무순위)의 식별자. 받은 뒤 집계를 행에 싣는다. */
  units?: { kind: 'apt' | 'remainder'; houseManageNo: string; pblancNo: string }
}

/**
 * 공통 적재. 후보마다 기존 행과 해시·상태를 비교해 바뀐 것만 upsert한다.
 * 슬러그는 기존 행이 있으면 그대로, 없으면 제목에서 만들고 충돌 시 접미를 붙인다.
 * 주택형 조회가 실패한 공고는 이번 배치에서 빼고 failed로 센다(해시가 저장되지 않아 다음 실행이 다시 시도한다).
 */
async function upsertChanged(source: HousingSource, candidates: Candidate[], keepIds: string[], deps: HousingSyncDeps, result: HousingSourceResult, log: (m: string) => void) {
  const batchSize = deps.batchSize ?? 100
  const existing = await deps.repo.getExisting(source)
  const usedSlugs = await deps.repo.allSlugs()
  const changed: Candidate[] = []
  for (const c of candidates) {
    const prev = existing.get(c.row.source_id)
    if (prev && prev.content_hash === c.row.content_hash && prev.status === c.row.status) {
      result.skipped++
      continue
    }
    c.row.slug = prev?.slug ?? allocateSlug(housingSlugBase(c.row.title), usedSlugs)
    changed.push(c)
  }
  result.changed = changed.length

  for (let i = 0; i < changed.length; i += batchSize) {
    const batch: Candidate[] = []
    const unitRows = new Map<string, HousingUnitTypeInput[]>()
    for (const c of changed.slice(i, i + batchSize)) {
      if (c.units) {
        let units: HousingUnitTypeInput[]
        try {
          units = unitsFromMdl(await deps.fetchUnits(c.units.kind, c.units.houseManageNo, c.units.pblancNo))
        } catch (err) {
          result.failed++
          console.error(`[housing-sync:${source}] 주택형 조회 실패 ${c.row.source_id}:`, errorMessage(err))
          continue
        }
        unitRows.set(c.row.source_id, units)
        const sum = (pick: (u: HousingUnitTypeInput) => number | null) => units.reduce((a, u) => a + (pick(u) ?? 0), 0)
        c.row.sp_newlywed_units = sum((u) => u.sp_newlywed)
        c.row.sp_first_life_units = sum((u) => u.sp_first_life)
        c.row.sp_multi_child_units = sum((u) => u.sp_multi_child)
      }
      batch.push(c)
    }
    if (!batch.length) continue
    const ids = await deps.repo.upsertNotices(batch.map((c) => c.row))
    for (const [sourceId, units] of unitRows) {
      const id = ids.get(sourceId)
      if (!id) continue
      try {
        await deps.repo.replaceUnitTypes(id, units)
      } catch (err) {
        result.failed++
        console.error(`[housing-sync:${source}] 주택형 저장 실패 ${sourceId}:`, errorMessage(err))
      }
    }
    result.upserted += batch.length
    result.changedSlugs.push(...batch.map((c) => c.row.slug))
    log(`upserted ${result.upserted}/${changed.length}`)
  }

  result.removedSlugs = await deps.repo.markRemoved(source, keepIds)
  result.removed = result.removedSlugs.length
}

const syncApplyhome: SourceBody = async (deps, now, result, log) => {
  const { apt, remainder, urbty } = await deps.fetchApplyhome()
  result.fetched = apt.length + remainder.length + urbty.length
  log(`fetched apt=${apt.length} remainder=${remainder.length} urbty=${urbty.length}`)
  const last = await deps.repo.lastSuccessfulFetched('applyhome')
  if (shouldAbortForDrop(last, result.fetched)) {
    result.aborted_reason = `건수 급감: 직전 ${last ?? '없음'} → 이번 ${result.fetched}`
    return
  }
  const candidates: Candidate[] = [
    ...apt.map((i) => ({ row: normalizeApt(i, [], '', now), units: { kind: 'apt' as const, houseManageNo: i.HOUSE_MANAGE_NO, pblancNo: i.PBLANC_NO } })),
    ...remainder.map((i) => ({ row: normalizeRemainder(i, [], '', now), units: { kind: 'remainder' as const, houseManageNo: i.HOUSE_MANAGE_NO, pblancNo: i.PBLANC_NO } })),
    ...urbty.map((i) => ({ row: normalizeUrbty(i, '', now) })),
  ]
  await upsertChanged('applyhome', candidates, candidates.map((c) => c.row.source_id), deps, result, log)
}

const syncLh: SourceBody = async (deps, now, result, log) => {
  const items = await deps.fetchLh()
  result.fetched = items.length
  log(`fetched ${items.length}`)
  const last = await deps.repo.lastSuccessfulFetched('lh')
  if (shouldAbortForDrop(last, result.fetched)) {
    result.aborted_reason = `건수 급감: 직전 ${last ?? '없음'} → 이번 ${result.fetched}`
    return
  }
  const candidates: Candidate[] = []
  for (const i of items) {
    const row = normalizeLh(i, '', now)
    if (row) candidates.push({ row })
  }
  await upsertChanged('lh', candidates, candidates.map((c) => c.row.source_id), deps, result, log)
}
