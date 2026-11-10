import { ZodError } from 'zod'
import { parseLhList, type LhNoticeItem } from './lh-schema'
import { housingApiKey, MAX_ATTEMPTS, RETRY_BASE_MS, RetryableError, sleep } from './applyhome'

const BASE_URL = 'https://apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1'

/** 설계 4절: 분양주택·임대주택·주거복지·신혼희망타운만. 토지·상가는 받지 않는다. */
export const LH_UPP_AIS_TP_CDS = ['05', '06', '13', '39'] as const

export interface LhFetchOptions {
  pageSize?: number
  delayMs?: number
  /** 재시도 백오프 기준(ms). 기본 500. 테스트에서 0으로 둔다. */
  retryBaseMs?: number
  onPage?: (cd: string, page: number, total: number) => void
}

type Page = { items: LhNoticeItem[]; total: number }

// 오류 메시지에는 URL(serviceKey 포함)을 절대 넣지 않는다.
async function requestOnce(cd: string, page: number, url: string): Promise<Page> {
  let res: Response
  try {
    res = await fetch(url, { cache: 'no-store' })
  } catch (e) {
    if (e instanceof TypeError) throw new RetryableError(`lh ${cd} p${page} 네트워크 오류: ${e.message}`)
    throw e
  }
  const text = await res.text()
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
    throw new Error(`lh ${cd} JSON이 아님: ${text.slice(0, 200)}`)
  }
  try {
    return parseLhList(json)
  } catch (e) {
    if (e instanceof ZodError) {
      const issues = e.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      throw new Error(`lh ${cd} 스키마 불일치: ${issues}`)
    }
    throw e
  }
}

async function fetchPage(key: string, cd: string, page: number, pageSize: number, retryBaseMs: number): Promise<Page> {
  const url = new URL(BASE_URL)
  url.searchParams.set('serviceKey', key)
  url.searchParams.set('PG_SZ', String(pageSize))
  url.searchParams.set('PAGE', String(page))
  url.searchParams.set('UPP_AIS_TP_CD', cd)
  const href = url.toString()
  for (let attempt = 0; ; attempt++) {
    try {
      return await requestOnce(cd, page, href)
    } catch (e) {
      if (!(e instanceof RetryableError) || attempt >= MAX_ATTEMPTS - 1) throw e
      await sleep(retryBaseMs * 2 ** attempt)
    }
  }
}

/** 유형 4종의 공고 전체. 페이지는 ALL_CNT로 센다. 게시일 필터는 API가 믿을 만하지 않아 정규화 단계에서 거른다. */
export async function fetchLhNotices(opts: LhFetchOptions = {}): Promise<LhNoticeItem[]> {
  const key = housingApiKey() // 요청 전에 키 누락을 먼저 드러낸다
  const pageSize = opts.pageSize ?? 100
  const delayMs = opts.delayMs ?? 300
  const retryBaseMs = opts.retryBaseMs ?? RETRY_BASE_MS
  const all: LhNoticeItem[] = []
  for (const cd of LH_UPP_AIS_TP_CDS) {
    let page = 1
    let total = Infinity
    while ((page - 1) * pageSize < total) {
      const r = await fetchPage(key, cd, page, pageSize, retryBaseMs)
      total = r.total
      all.push(...r.items)
      opts.onPage?.(cd, page, total)
      if (r.items.length === 0) break // 안전장치: ALL_CNT가 틀려도 빈 페이지에서 멈춘다
      page++
      if (delayMs > 0 && (page - 1) * pageSize < total) await sleep(delayMs)
    }
  }
  // 페이지를 넘기는 사이 행이 밀리면 같은 공고가 두 번 올 수 있다. 첫 번째만 둔다.
  const seen = new Set<string>()
  return all.filter((r) => (seen.has(r.PAN_ID) ? false : (seen.add(r.PAN_ID), true)))
}
