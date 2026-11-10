import type { AptDetailItem, RemainderDetailItem, UrbtyDetailItem, MdlItem } from '@/lib/api/applyhome-schema'
import type { LhNoticeItem } from '@/lib/api/lh-schema'
import type { SyncRunRow } from '@/types/database'
import type { HousingNoticeRow, HousingSource, HousingUnitTypeInput } from '@/types/housing'
import { allocateSlug } from '@/lib/benefits/slug'
import { errorMessage } from './gov24-sync'
import { shouldAbortForDrop } from './diff'
import { housingSlugBase, normalizeApt, normalizeLh, normalizeRemainder, normalizeUrbty, unitsFromMdl } from './housing-normalize'
import type { HousingRepo, HousingSourceResult, HousingSyncResult } from './housing-types'

/** fetcher에 넘기는 요청 옵션. 클라이언트가 요청 시간 초과·재시도를 마감 안으로 줄이는 데 쓴다. */
export interface HousingFetchOpts {
  deadlineMs?: number
}

export interface HousingSyncDeps {
  repo: HousingRepo
  fetchApplyhome: (opts: HousingFetchOpts) => Promise<{ apt: AptDetailItem[]; remainder: RemainderDetailItem[]; urbty: UrbtyDetailItem[] }>
  /** 바뀐 APT·무순위 공고의 주택형. 바뀌지 않은 공고에는 부르지 않는다. */
  fetchUnits: (kind: 'apt' | 'remainder', houseManageNo: string, pblancNo: string, opts: HousingFetchOpts) => Promise<MdlItem[]>
  fetchLh: (opts: HousingFetchOpts) => Promise<LhNoticeItem[]>
  now?: Date
  /**
   * 동기화 창의 시작(YYYY-MM-DD, 설계 4절: 최근 180일). 청약홈은 fetcher가 API 조건으로 걸고,
   * LH는 날짜 조건을 믿을 수 없어 syncLh가 공고일로 거른다.
   */
  since: string
  batchSize?: number
  /**
   * 시간 예산의 끝(epoch ms). 넘으면 남은 공고는 upsert하지 않고 다음 실행으로 미룬다.
   * fetcher에도 넘긴다. 요청 중에 마감이 오면 클라이언트가 던지고, 그 소스는 error로 끝난다
   * (markRemoved는 돌지 않고, 라우트는 상세 캐시를 전부 비운다).
   */
  deadlineMs?: number
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
    try {
      await deps.repo.recordRun(run)
    } catch (err) {
      console.error(`[housing-sync:${source}] recordRun 실패:`, errorMessage(err))
    }
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

  let outOfTime = false
  for (let i = 0; i < changed.length && !outOfTime; i += batchSize) {
    const batch: Candidate[] = []
    const unitRows = new Map<string, HousingUnitTypeInput[]>()
    const slice = changed.slice(i, i + batchSize)
    for (let j = 0; j < slice.length; j++) {
      const c = slice[j]
      if (c.units) {
        if (deps.deadlineMs != null && Date.now() > deps.deadlineMs) {
          // 남은 공고는 해시가 저장되지 않아 다음 실행이 다시 집는다. 이미 모은 배치는 아래에서 저장한다.
          outOfTime = true
          result.aborted_reason = `시간 예산 초과: ${changed.length - i - j}건은 다음 실행에서`
          break
        }
        let units: HousingUnitTypeInput[]
        try {
          units = unitsFromMdl(await deps.fetchUnits(c.units.kind, c.units.houseManageNo, c.units.pblancNo, { deadlineMs: deps.deadlineMs }))
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
    const byId = new Map(batch.map((c) => [c.row.source_id, c]))
    const ids = await deps.repo.upsertNotices(batch.map((c) => c.row))
    for (const [sourceId, units] of unitRows) {
      const id = ids.get(sourceId)
      if (!id) {
        result.failed++
        console.error(`[housing-sync:${source}] upsert 결과에 id 없음 ${sourceId}`)
        continue
      }
      try {
        await deps.repo.replaceUnitTypes(id, units)
      } catch (err) {
        result.failed++
        console.error(`[housing-sync:${source}] 주택형 저장 실패 ${sourceId}:`, errorMessage(err))
        // 행은 이미 새 해시로 저장돼 다음 실행이 "변경 없음"으로 건너뛴다.
        // 해시를 비워 다시 쓰면 다음 실행에서 불일치로 잡혀 주택형을 재시도한다.
        try {
          await deps.repo.upsertNotices([{ ...byId.get(sourceId)!.row, content_hash: '' }])
        } catch (err2) {
          console.error(`[housing-sync:${source}] 해시 초기화 실패 ${sourceId}:`, errorMessage(err2))
        }
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
  if (deps.deadlineMs != null && Date.now() > deps.deadlineMs) {
    result.aborted_reason = '시간 예산 초과: 이번 실행에서 건너뜀'
    return
  }
  const { apt, remainder, urbty } = await deps.fetchApplyhome({ deadlineMs: deps.deadlineMs })
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
  if (result.fetched > 0 && candidates.length === 0) {
    result.aborted_reason = '정규화 결과 0건(유형 코드 변경?)'
    return
  }
  await upsertChanged('applyhome', candidates, candidates.map((c) => c.row.source_id), deps, result, log)
}

const syncLh: SourceBody = async (deps, now, result, log) => {
  if (deps.deadlineMs != null && Date.now() > deps.deadlineMs) {
    result.aborted_reason = '시간 예산 초과: 이번 실행에서 건너뜀'
    return
  }
  const items = await deps.fetchLh({ deadlineMs: deps.deadlineMs })
  result.fetched = items.length
  log(`fetched ${items.length}`)
  const last = await deps.repo.lastSuccessfulFetched('lh')
  if (shouldAbortForDrop(last, result.fetched)) {
    result.aborted_reason = `건수 급감: 직전 ${last ?? '없음'} → 이번 ${result.fetched}`
    return
  }
  const inScope: HousingNoticeRow[] = []
  for (const i of items) {
    const row = normalizeLh(i, '', now)
    if (row) inScope.push(row)
  }
  if (items.length > 0 && inScope.length === 0) {
    result.aborted_reason = '정규화 결과 0건(유형 코드 변경?)'
    return
  }
  // 창 밖 공고는 후보가 아니다(markRemoved의 keep에도 넣지 않는다). 공고일이 없으면 판단할 수 없어 둔다.
  // 문자열 비교가 안전한 이유: notice_date는 toIsoDate가 만든 YYYY-MM-DD다.
  const candidates: Candidate[] = inScope.filter((row) => row.notice_date == null || row.notice_date >= deps.since).map((row) => ({ row }))
  if (candidates.length < inScope.length) log(`since ${deps.since} 이전 공고 ${inScope.length - candidates.length}건 제외`)
  await upsertChanged('lh', candidates, candidates.map((c) => c.row.source_id), deps, result, log)
}
