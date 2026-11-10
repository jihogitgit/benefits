import { z } from 'zod'
import {
  aptDetailResponse,
  remainderDetailResponse,
  urbtyDetailResponse,
  aptMdlResponse,
  type AptDetailItem,
  type RemainderDetailItem,
  type UrbtyDetailItem,
  type MdlItem,
} from './applyhome-schema'

const BASE_URL = 'https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1'

export type ApplyhomeDetailOp = 'getAPTLttotPblancDetail' | 'getRemndrLttotPblancDetail' | 'getUrbtyOfctlLttotPblancDetail'
export type ApplyhomeMdlOp = 'getAPTLttotPblancMdl' | 'getRemndrLttotPblancMdl'

/** 공공데이터포털 인증키는 계정 단위라 보조금24 키와 같은 값인 경우가 대부분이다. 따로 두면 그것을 우선한다. */
export function housingApiKey(): string {
  const key = process.env.HOUSING_API_KEY?.trim() || process.env.GOV24_API_KEY?.trim()
  if (!key) throw new Error('HOUSING_API_KEY(또는 GOV24_API_KEY) 환경변수가 없습니다')
  return key
}

const SCHEMA: Record<ApplyhomeDetailOp | ApplyhomeMdlOp, z.ZodTypeAny> = {
  getAPTLttotPblancDetail: aptDetailResponse,
  getRemndrLttotPblancDetail: remainderDetailResponse,
  getUrbtyOfctlLttotPblancDetail: urbtyDetailResponse,
  getAPTLttotPblancMdl: aptMdlResponse,
  getRemndrLttotPblancMdl: aptMdlResponse,
}

interface Page<T> { data: T[]; totalCount: number }

// 일시 오류(429·5xx·네트워크)만 재시도한다. 4xx·스키마·API 오류는 다시 해도 같으므로 바로 던진다.
export const MAX_ATTEMPTS = 3
export const RETRY_BASE_MS = 500
/** 요청 하나의 상한(ms). 멈춘 연결이 함수 시간을 다 먹지 않게 한다. */
export const REQUEST_TIMEOUT_MS = 15_000
/** 시간 초과·중단은 네트워크 오류와 같이 재시도한다. */
export const isTimeoutError = (e: unknown): e is Error => e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')

export class RetryableError extends Error {}

/** 시간 예산(deadlineMs)이 다 돼 요청하지 않았다. 재시도 대상이 아니고, 호출자는 실패가 아니라 "다음 실행으로 미룸"으로 다룬다. */
export class DeadlineError extends Error {
  override name = 'DeadlineError'
}

export const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

/** 재시도는 백오프 뒤에도 이만큼은 남아 있어야 한다. 못 미치면 기다리지 않고 바로 던진다. */
const MIN_RETRY_HEADROOM_MS = 1_000

/**
 * 시간 예산(deadlineMs, epoch ms)이 있으면 남은 시간을, 없으면 Infinity를 돌려준다.
 * 이미 지났으면 재시도 대상이 아닌 오류로 던진다 — 다시 해도 시간은 더 줄 뿐이다.
 */
export function remainingBudgetMs(deadlineMs: number | undefined, label: string): number {
  if (deadlineMs == null) return Infinity
  const remaining = deadlineMs - Date.now()
  if (remaining <= 0) throw new DeadlineError(`${label} 시간 예산 초과`)
  return remaining
}

/** 백오프(ms)를 기다린 뒤 재시도해도 마감 안에 들어오는가. */
export function canRetryWithin(deadlineMs: number | undefined, backoffMs: number): boolean {
  return deadlineMs == null || deadlineMs - Date.now() >= backoffMs + MIN_RETRY_HEADROOM_MS
}

async function requestOnce<T>(op: ApplyhomeDetailOp | ApplyhomeMdlOp, url: string, deadlineMs: number | undefined): Promise<Page<T>> {
  // 요청 하나가 마감을 넘기지 않게 시간 초과를 남은 예산으로 줄인다. 멈춘 연결 하나가 15초×3을 먹으면 cron이 60초를 넘는다.
  const timeoutMs = Math.min(REQUEST_TIMEOUT_MS, remainingBudgetMs(deadlineMs, `applyhome ${op}`))
  let res: Response
  let text: string
  try {
    res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) })
    text = await res.text() // 본문 읽기 중 시간 초과도 같은 경로로 잡는다
  } catch (e) {
    // AbortError도 재시도한다: 외부 signal을 넘기는 호출자가 없어 취소가 아니라 시간 초과다.
    if (isTimeoutError(e)) throw new RetryableError(`applyhome ${op} 시간 초과: ${e.message}`)
    if (e instanceof TypeError) throw new RetryableError(`applyhome ${op} 네트워크 오류: ${e.message}`)
    throw e
  }
  if (!res.ok) {
    const msg = `applyhome ${op} HTTP ${res.status}: ${text.slice(0, 200)}`
    if (res.status === 429 || res.status >= 500) throw new RetryableError(msg)
    throw new Error(msg)
  }
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw new Error(`applyhome ${op} JSON이 아님: ${text.slice(0, 200)}`)
  }
  const obj = body as { code?: unknown; msg?: unknown; data?: unknown }
  if (obj && typeof obj === 'object' && obj.code !== undefined && !Array.isArray(obj.data)) {
    throw new Error(`applyhome ${op} API 오류 ${String(obj.code)}: ${String(obj.msg ?? '')}`)
  }
  const parsed = SCHEMA[op].safeParse(body)
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`applyhome ${op} 스키마 불일치: ${issues}`)
  }
  const ok = parsed.data as { data: T[]; totalCount: number }
  return { data: ok.data, totalCount: ok.totalCount }
}

async function fetchPage<T>(op: ApplyhomeDetailOp | ApplyhomeMdlOp, key: string, page: number, perPage: number, cond: Record<string, string>, retryBaseMs: number, deadlineMs: number | undefined): Promise<Page<T>> {
  const url = new URL(`${BASE_URL}/${op}`)
  url.searchParams.set('page', String(page))
  url.searchParams.set('perPage', String(perPage))
  url.searchParams.set('returnType', 'JSON')
  url.searchParams.set('serviceKey', key)
  // odcloud 검색 조건: cond[필드::연산자]=값. 연산자는 EQ·GT·GTE·LT·LTE·LIKE.
  for (const [k, v] of Object.entries(cond)) url.searchParams.set(`cond[${k}]`, v)

  for (let attempt = 0; ; attempt++) {
    try {
      return await requestOnce<T>(op, url.toString(), deadlineMs)
    } catch (e) {
      if (!(e instanceof RetryableError) || attempt >= MAX_ATTEMPTS - 1) throw e
      const backoffMs = retryBaseMs * 2 ** attempt
      if (!canRetryWithin(deadlineMs, backoffMs)) throw e // 기다리면 마감을 넘긴다
      await sleep(backoffMs)
    }
  }
}

export interface ApplyhomeFetchOptions {
  perPage?: number
  delayMs?: number
  /** 재시도 백오프 기준(ms). 기본 500. 테스트에서 0으로 둔다. */
  retryBaseMs?: number
  /** 시간 예산의 끝(epoch ms). 요청 시간 초과를 남은 예산으로 줄이고, 넘으면 재시도 없이 던진다. */
  deadlineMs?: number
  onPage?: (op: string, page: number, totalPages: number) => void
}

async function fetchAll<T extends { HOUSE_MANAGE_NO: string; PBLANC_NO: string; MODEL_NO?: string | null }>(
  op: ApplyhomeDetailOp | ApplyhomeMdlOp,
  cond: Record<string, string>,
  opts: ApplyhomeFetchOptions,
): Promise<T[]> {
  const key = housingApiKey() // 요청 전에 키 누락을 먼저 드러낸다
  const perPage = opts.perPage ?? 500
  const delayMs = opts.delayMs ?? 300
  const retryBaseMs = opts.retryBaseMs ?? RETRY_BASE_MS
  const isMdl = op.endsWith('Mdl')
  const all: T[] = []
  let page = 1
  let totalPages = 1
  while (page <= totalPages) {
    remainingBudgetMs(opts.deadlineMs, `applyhome ${op} p${page}`) // 페이지 사이에서도 확인한다
    const r = await fetchPage<T>(op, key, page, perPage, cond, retryBaseMs, opts.deadlineMs)
    totalPages = Math.max(1, Math.ceil(r.totalCount / perPage))
    all.push(...r.data)
    opts.onPage?.(op, page, totalPages)
    if (r.data.length === 0) break // totalCount가 틀려도 무한히 돌지 않게
    page++
    if (page <= totalPages && delayMs > 0) await sleep(delayMs)
  }
  // 페이지를 넘기는 사이 행이 밀리면 같은 행이 두 번 올 수 있다. 첫 번째만 둔다.
  const seen = new Set<string>()
  return all.filter((r) => {
    if (isMdl && r.MODEL_NO == null) return true // 주택형 번호가 없으면 같은 행인지 알 수 없어 그대로 둔다
    const k = `${r.HOUSE_MANAGE_NO}|${r.PBLANC_NO}${isMdl ? `|${r.MODEL_NO ?? ''}` : ''}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export interface ApplyhomeDetails {
  apt: AptDetailItem[]
  remainder: RemainderDetailItem[]
  urbty: UrbtyDetailItem[]
}

/** 모집공고일이 since(YYYY-MM-DD) 이후인 공고 3종. 과거 전체를 받지 않는다(설계 4절). */
export async function fetchApplyhomeDetails(since: string, opts: ApplyhomeFetchOptions = {}): Promise<ApplyhomeDetails> {
  const cond = { 'RCRIT_PBLANC_DE::GTE': since }
  // 순차 실행: delayMs가 요청 간격으로 실제로 작동하게 한다.
  const apt = await fetchAll<AptDetailItem>('getAPTLttotPblancDetail', cond, opts)
  remainingBudgetMs(opts.deadlineMs, 'applyhome getRemndrLttotPblancDetail')
  const remainder = await fetchAll<RemainderDetailItem>('getRemndrLttotPblancDetail', cond, opts)
  remainingBudgetMs(opts.deadlineMs, 'applyhome getUrbtyOfctlLttotPblancDetail')
  const urbty = await fetchAll<UrbtyDetailItem>('getUrbtyOfctlLttotPblancDetail', cond, opts)
  return { apt, remainder, urbty }
}

/**
 * 공고 하나의 주택형 행. 바뀐 공고에 대해서만 부른다 — 전체 주택형을 매일 받으면 수만 행이고,
 * 공고마다 부르면 첫 적재 때만 수백 번이다(이후 하루 몇 번).
 */
export async function fetchApplyhomeUnits(kind: 'apt' | 'remainder', houseManageNo: string, pblancNo: string, opts: ApplyhomeFetchOptions = {}): Promise<MdlItem[]> {
  const op: ApplyhomeMdlOp = kind === 'apt' ? 'getAPTLttotPblancMdl' : 'getRemndrLttotPblancMdl'
  return fetchAll<MdlItem>(op, { 'HOUSE_MANAGE_NO::EQ': houseManageNo, 'PBLANC_NO::EQ': pblancNo }, { ...opts, perPage: 100 })
}
