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

async function fetchPage<T>(op: ApplyhomeDetailOp | ApplyhomeMdlOp, page: number, perPage: number, cond: Record<string, string>): Promise<Page<T>> {
  const url = new URL(`${BASE_URL}/${op}`)
  url.searchParams.set('page', String(page))
  url.searchParams.set('perPage', String(perPage))
  url.searchParams.set('returnType', 'JSON')
  url.searchParams.set('serviceKey', housingApiKey())
  // odcloud 검색 조건: cond[필드::연산자]=값. 연산자는 EQ·GT·GTE·LT·LTE·LIKE.
  for (const [k, v] of Object.entries(cond)) url.searchParams.set(`cond[${k}]`, v)

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`applyhome ${op} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const parsed = SCHEMA[op].parse(await res.json()) as { data: T[]; totalCount: number }
  return { data: parsed.data, totalCount: parsed.totalCount }
}

export interface ApplyhomeFetchOptions {
  perPage?: number
  delayMs?: number
  onPage?: (op: string, page: number, totalPages: number) => void
}

async function fetchAll<T>(op: ApplyhomeDetailOp | ApplyhomeMdlOp, cond: Record<string, string>, opts: ApplyhomeFetchOptions): Promise<T[]> {
  const perPage = opts.perPage ?? 500
  const delayMs = opts.delayMs ?? 300
  const all: T[] = []
  let page = 1
  let totalPages = 1
  while (page <= totalPages) {
    const r = await fetchPage<T>(op, page, perPage, cond)
    totalPages = Math.max(1, Math.ceil(r.totalCount / perPage))
    all.push(...r.data)
    opts.onPage?.(op, page, totalPages)
    page++
    if (page <= totalPages && delayMs > 0) await new Promise((res) => setTimeout(res, delayMs))
  }
  return all
}

export interface ApplyhomeDetails {
  apt: AptDetailItem[]
  remainder: RemainderDetailItem[]
  urbty: UrbtyDetailItem[]
}

/** 모집공고일이 since(YYYY-MM-DD) 이후인 공고 3종. 과거 전체를 받지 않는다(설계 4절). */
export async function fetchApplyhomeDetails(since: string, opts: ApplyhomeFetchOptions = {}): Promise<ApplyhomeDetails> {
  const cond = { 'RCRIT_PBLANC_DE::GTE': since }
  const [apt, remainder, urbty] = await Promise.all([
    fetchAll<AptDetailItem>('getAPTLttotPblancDetail', cond, opts),
    fetchAll<RemainderDetailItem>('getRemndrLttotPblancDetail', cond, opts),
    fetchAll<UrbtyDetailItem>('getUrbtyOfctlLttotPblancDetail', cond, opts),
  ])
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
