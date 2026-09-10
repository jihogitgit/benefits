import {
  serviceListResponse,
  supportConditionsResponse,
  type ServiceListItem,
  type SupportConditionItem,
} from './gov24-schema'

const BASE_URL = 'https://api.odcloud.kr/api/gov24/v3'

export type Gov24Op = 'serviceList' | 'supportConditions'

type ItemOf<O extends Gov24Op> = O extends 'serviceList' ? ServiceListItem : SupportConditionItem

export interface PageResult<O extends Gov24Op> {
  data: ItemOf<O>[]
  totalCount: number
  page: number
  perPage: number
}

function apiKey(): string {
  const key = process.env.GOV24_API_KEY
  if (!key) throw new Error('GOV24_API_KEY 환경변수가 없습니다')
  return key
}

export async function fetchPage<O extends Gov24Op>(op: O, page: number, perPage: number): Promise<PageResult<O>> {
  const url = new URL(`${BASE_URL}/${op}`)
  url.searchParams.set('page', String(page))
  url.searchParams.set('perPage', String(perPage))
  url.searchParams.set('returnType', 'JSON')
  url.searchParams.set('serviceKey', apiKey())

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`gov24 ${op} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()

  const parsed = op === 'serviceList' ? serviceListResponse.parse(json) : supportConditionsResponse.parse(json)
  return { data: parsed.data as ItemOf<O>[], totalCount: parsed.totalCount, page: parsed.page, perPage: parsed.perPage }
}

export interface FetchAllOptions {
  perPage?: number
  delayMs?: number
  onPage?: (page: number, totalPages: number) => void
}

export async function fetchAll<O extends Gov24Op>(op: O, opts: FetchAllOptions = {}): Promise<ItemOf<O>[]> {
  const perPage = opts.perPage ?? 1000
  const delayMs = opts.delayMs ?? 300
  const all: ItemOf<O>[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const result = await fetchPage(op, page, perPage)
    totalPages = Math.max(1, Math.ceil(result.totalCount / perPage))
    all.push(...result.data)
    opts.onPage?.(page, totalPages)
    page++
    if (page <= totalPages && delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
  }
  return all
}
