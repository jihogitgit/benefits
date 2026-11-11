import { ZodError } from 'zod'
import { parseLhList, type LhNoticeItem } from './lh-schema'
import { canRetryWithin, housingApiKey, isTimeoutError, MAX_ATTEMPTS, remainingBudgetMs, REQUEST_TIMEOUT_MS, RETRY_BASE_MS, RetryableError, sleep } from './applyhome'

const BASE_URL = 'https://apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1'

/** 설계 4절: 분양주택·임대주택·주거복지·신혼희망타운만. 토지·상가는 받지 않는다. */
export const LH_UPP_AIS_TP_CDS = ['05', '06', '13', '39'] as const

export interface LhFetchOptions {
  /**
   * 공고 게시일 조회 시작(YYYY-MM-DD). 안 주면 LH가 최근 2개월만 돌려준다(실측 2026-11-11:
   * 기본 270건, 180일 987건). 동기화는 항상 넘긴다.
   */
  since?: string
  /** 조회 끝(YYYY-MM-DD). 기본은 오늘(KST). since와 함께만 쓰인다. */
  until?: string
  pageSize?: number
  delayMs?: number
  /** 재시도 백오프 기준(ms). 기본 500. 테스트에서 0으로 둔다. */
  retryBaseMs?: number
  /** 시간 예산의 끝(epoch ms). 요청 시간 초과를 남은 예산으로 줄이고, 넘으면 재시도 없이 던진다. */
  deadlineMs?: number
  /** total은 첫 페이지 ALL_CNT. 믿을 수 없으면 null(미상). */
  onPage?: (cd: string, page: number, total: number | null) => void
}

/**
 * 코드 하나당 페이지 상한. 응답이 계속 가득 차는 이상 상황에서 무한히 돌지 않게 한다.
 * 10페이지×100건 = 코드당 1,000건(180일 창 실측 최대 621건). 넉넉히 두되 cron 시간 예산을 넘지 않게 낮게 둔다.
 */
const MAX_PAGES = 10

type Page = { items: LhNoticeItem[]; total: number | null }

// 오류 메시지에는 URL(serviceKey 포함)을 절대 넣지 않는다.
async function requestOnce(cd: string, page: number, url: string, deadlineMs: number | undefined): Promise<Page> {
  // 요청 하나가 마감을 넘기지 않게 시간 초과를 남은 예산으로 줄인다.
  const timeoutMs = Math.min(REQUEST_TIMEOUT_MS, remainingBudgetMs(deadlineMs, `lh ${cd} p${page}`))
  let res: Response
  let text: string
  try {
    res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) })
    text = await res.text() // 본문 읽기 중 시간 초과도 같은 경로로 잡는다
  } catch (e) {
    // AbortError도 재시도한다: 외부 signal을 넘기는 호출자가 없어 취소가 아니라 시간 초과다.
    if (isTimeoutError(e)) throw new RetryableError(`lh ${cd} p${page} 시간 초과: ${e.message}`)
    if (e instanceof TypeError) throw new RetryableError(`lh ${cd} p${page} 네트워크 오류: ${e.message}`)
    throw e
  }
  if (!res.ok) {
    const msg = `lh ${cd} p${page} HTTP ${res.status}: ${text.slice(0, 200)}`
    if (res.status === 429 || res.status >= 500) throw new RetryableError(msg)
    throw new Error(msg)
  }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    // 인증키 오류 등은 XML로 온다(<OpenAPI_ServiceResponse>). 앞부분을 그대로 보여준다.
    throw new Error(`lh ${cd} p${page} JSON이 아님: ${text.slice(0, 200)}`)
  }
  try {
    return parseLhList(json)
  } catch (e) {
    if (e instanceof ZodError) {
      const issues = e.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      throw new Error(`lh ${cd} p${page} 스키마 불일치: ${issues}`)
    }
    // 헤더 오류(SS_CODE != Y) 등 재시도 대상이 아닌 오류
    if (e instanceof Error) throw new Error(`lh ${cd} p${page} ${e.message}`)
    throw e
  }
}

/** 오늘 날짜(KST, YYYY-MM-DD). LH는 한국 날짜로 게시일을 센다. */
function todayKst(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)
}

/** LH 조회 조건은 YYYYMMDD만 받는다. 점 표기(2026.05.15)는 오류 없이 0건을 돌려준다(실측). */
function lhDate(iso: string, name: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error(`lh ${name} 형식 오류(YYYY-MM-DD 필요): ${iso}`)
  return iso.replaceAll('-', '')
}

type Range = { st: string; ed: string } | null

async function fetchPage(key: string, cd: string, page: number, pageSize: number, retryBaseMs: number, deadlineMs: number | undefined, range: Range): Promise<Page> {
  const url = new URL(BASE_URL)
  url.searchParams.set('serviceKey', key)
  url.searchParams.set('PG_SZ', String(pageSize))
  url.searchParams.set('PAGE', String(page))
  url.searchParams.set('UPP_AIS_TP_CD', cd)
  if (range) {
    url.searchParams.set('PAN_ST_DT', range.st)
    url.searchParams.set('PAN_ED_DT', range.ed)
  }
  const href = url.toString()
  for (let attempt = 0; ; attempt++) {
    try {
      return await requestOnce(cd, page, href, deadlineMs)
    } catch (e) {
      if (!(e instanceof RetryableError) || attempt >= MAX_ATTEMPTS - 1) throw e
      const backoffMs = retryBaseMs * 2 ** attempt
      if (!canRetryWithin(deadlineMs, backoffMs)) throw e // 기다리면 마감을 넘긴다
      await sleep(backoffMs)
    }
  }
}

/**
 * 유형 4종의 공고. 페이지는 ALL_CNT로 센다. `since`를 주면 게시일 조건(PAN_ST_DT~PAN_ED_DT)을 건다.
 * 조건이 없으면 LH 기본값(최근 2개월)이 적용돼 오래 접수하는 공고가 빠진다.
 * 동기화(housing-sync의 syncLh)는 받은 뒤에도 공고일로 한 번 더 거른다.
 */
export async function fetchLhNotices(opts: LhFetchOptions = {}): Promise<LhNoticeItem[]> {
  const key = housingApiKey() // 요청 전에 키 누락을 먼저 드러낸다
  const pageSize = opts.pageSize ?? 100
  const delayMs = opts.delayMs ?? 300
  const retryBaseMs = opts.retryBaseMs ?? RETRY_BASE_MS
  const range: Range = opts.since ? { st: lhDate(opts.since, 'since'), ed: lhDate(opts.until ?? todayKst(), 'until') } : null
  const all: LhNoticeItem[] = []
  for (const cd of LH_UPP_AIS_TP_CDS) {
    let total: number | null = 0
    for (let page = 1; ; page++) {
      // 받은 페이지 수와 첫 페이지 ALL_CNT를 남겨 상한을 올릴지(정상 증가) 원천 이상인지 가릴 수 있게 한다.
      if (page > MAX_PAGES) throw new Error(`lh ${cd} 페이지 상한 ${MAX_PAGES} 초과(ALL_CNT=${total ?? '미상'})`)
      remainingBudgetMs(opts.deadlineMs, `lh ${cd} p${page}`) // 페이지·코드 사이에서도 확인한다
      const r = await fetchPage(key, cd, page, pageSize, retryBaseMs, opts.deadlineMs, range)
      if (page === 1) total = r.total // 첫 페이지 값으로 고정한다
      all.push(...r.items)
      opts.onPage?.(cd, page, total)
      if (r.items.length === 0) break // 안전장치: ALL_CNT가 틀려도 빈 페이지에서 멈춘다
      // 전체 건수를 모르면 가득 찬 페이지가 이어지는 동안만 계속한다
      if (total == null ? r.items.length < pageSize : page * pageSize >= total) break
      if (delayMs > 0) await sleep(delayMs)
    }
  }
  // 페이지를 넘기는 사이 행이 밀리면 같은 공고가 두 번 올 수 있다. 첫 번째만 둔다. 코드가 달라도 PAN_ID가 같으면 먼저 받은 코드의 행을 남긴다.
  const seen = new Set<string>()
  return all.filter((r) => (seen.has(r.PAN_ID) ? false : (seen.add(r.PAN_ID), true)))
}
