import type { ServiceListItem, SupportConditionItem } from '@/lib/api/gov24-schema'
import type { BenefitRow, ConditionRow, SyncRunRow } from '@/types/database'
import { normalizeConditions } from '@/lib/conditions/normalize'
import { slugify, allocateSlug } from '@/lib/benefits/slug'
import { kstDateString } from '@/lib/benefits/status'
import { normalizeBenefit, GOV24_SOURCE } from './normalize'
import { isChanged, shouldAbortForDrop } from './diff'
import type { BenefitsRepo, SyncResult } from './types'

export interface Gov24SyncDeps {
  repo: BenefitsRepo
  fetchList: () => Promise<ServiceListItem[]>
  fetchConditions: () => Promise<SupportConditionItem[]>
  now?: Date
  batchSize?: number
  log?: (msg: string) => void
  /** true면 수정일시가 같아도 전부 다시 정규화·upsert (코드맵·태깅 규칙 변경 후 재적용용) */
  force?: boolean
}

/** Error, Supabase 오류 객체({message, code, …}), 기타 값을 사람이 읽을 문자열로. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>
    if (typeof o.message === 'string') return [o.code, o.message].filter(Boolean).join(' ')
    try { return JSON.stringify(err) } catch { /* fallthrough */ }
  }
  return String(err)
}

/**
 * 보조금24 전체 목록·조건을 받아 변경분만 upsert하고, 마감·소멸 상태를 갱신한다.
 * 결과는 sync_runs에 항상 기록된다(성공·중단·예외 모두).
 */
/**
 * 원천에 섞여 들어오는 시연·테스트 레코드인지.
 *
 * 행정안전부의 '온라인 신청 시연 테스트(운영)'가 status=open으로 올라와 검색과 진단 결과에
 * 그대로 노출되고 있었다(summary가 "내용요약", 지원내용이 "신청 테스트 입니다.test").
 *
 * 제목만 보고 거르지 않는다. '시연'이 들어간 정상 사업이 나중에 생길 수 있어서, 제목 신호와
 * 본문 플레이스홀더 신호가 함께 있을 때만 버린다. 현재 데이터에서 이 조건에 걸리는 것은
 * 위 한 건뿐이다.
 */
export function isPlaceholder(item: { 서비스명?: string | null; 서비스목적요약?: string | null; 지원내용?: string | null }): boolean {
  const title = item.서비스명 ?? ''
  if (!/테스트|시연/.test(title)) return false
  const summary = (item.서비스목적요약 ?? '').trim()
  const amount = item.지원내용 ?? ''
  return summary === '내용요약' || /\btest\b/i.test(amount)
}

export async function runGov24Sync(deps: Gov24SyncDeps): Promise<SyncResult> {
  const now = deps.now ?? new Date()
  const log = deps.log ?? (() => {})
  const batchSize = deps.batchSize ?? 500
  const run: SyncRunRow = {
    source: GOV24_SOURCE,
    started_at: now.toISOString(),
    finished_at: null,
    fetched: 0,
    upserted: 0,
    skipped: 0,
    failed: 0,
    closed: 0,
    removed: 0,
    error: null,
    aborted_reason: null,
  }
  const result: SyncResult = {
    fetched: 0,
    changed: 0,
    upserted: 0,
    skipped: 0,
    failed: 0,
    closed: 0,
    removed: 0,
    aborted_reason: null,
    changedSlugs: [],
    changedSegments: [],
  }

  try {
    const [list, condItems] = await Promise.all([deps.fetchList(), deps.fetchConditions()])
    run.fetched = result.fetched = list.length
    log(`fetched list=${list.length} conditions=${condItems.length}`)

    const lastFetched = await deps.repo.lastSuccessfulFetched(GOV24_SOURCE)
    if (shouldAbortForDrop(lastFetched, list.length)) {
      run.aborted_reason = result.aborted_reason = `건수 급감: 직전 ${lastFetched ?? '없음'} → 이번 ${list.length}`
      log(run.aborted_reason)
      return result
    }

    const existing = await deps.repo.getExisting(GOV24_SOURCE)
    const usedSlugs = await deps.repo.allSlugs()
    const condBySource = new Map<string, ReturnType<typeof normalizeConditions>>()
    for (const c of condItems) condBySource.set(c.서비스ID, normalizeConditions(c))

    const changedRows: BenefitRow[] = []
    const segmentSet = new Set<string>()

    for (const item of list) {
      if (!item.서비스명?.trim()) {
        result.failed++
        continue
      }
      if (isPlaceholder(item)) {
        result.skipped++
        continue
      }
      const prev = existing.get(item.서비스ID)
      const cond = condBySource.get(item.서비스ID) ?? null
      const probe = normalizeBenefit(item, cond, prev?.slug ?? '', now)
      if (!deps.force && !isChanged(prev?.source_updated_at, probe.source_updated_at)) {
        result.skipped++
        continue
      }
      const slug = prev?.slug ?? allocateSlug(slugify(probe.title), usedSlugs)
      changedRows.push({ ...probe, slug })
      result.changedSlugs.push(slug)
      probe.segments.forEach((s) => segmentSet.add(s))
    }
    result.changed = changedRows.length
    result.changedSegments = [...segmentSet]

    for (let i = 0; i < changedRows.length; i += batchSize) {
      const batch = changedRows.slice(i, i + batchSize)
      const idBySource = await deps.repo.upsertBenefits(batch)
      const condRows: ConditionRow[] = []
      for (const row of batch) {
        const id = idBySource.get(row.source_id)
        const c = condBySource.get(row.source_id)
        if (!id || !c) continue
        condRows.push({
          benefit_id: id,
          age_min: c.age_min,
          age_max: c.age_max,
          gender: c.gender,
          income_bands: c.income_bands,
          life_stages: c.life_stages,
          household_types: c.household_types,
          occupations: c.occupations,
          region_codes: row.region_code === 'ALL' ? [] : [row.region_code],
        })
      }
      if (condRows.length) await deps.repo.upsertConditions(condRows)
      result.upserted += batch.length
      log(`upserted ${result.upserted}/${changedRows.length}`)
    }

    result.closed = await deps.repo.closeExpired(GOV24_SOURCE, kstDateString(now))
    result.removed = await deps.repo.markRemoved(GOV24_SOURCE, list.map((i) => i.서비스ID))

    run.upserted = result.upserted
    run.skipped = result.skipped
    run.failed = result.failed
    run.closed = result.closed
    run.removed = result.removed
    return result
  } catch (err) {
    run.error = errorMessage(err)
    throw err
  } finally {
    run.finished_at = new Date().toISOString()
    await deps.repo.recordRun(run)
  }
}
