import { z } from 'zod'

const str = z
  .union([z.string(), z.number()])
  .nullable()
  .optional()
  .transform((v) => (v == null ? null : String(v).trim() || null))

/** 분양임대공고문 조회(공공데이터포털 15058530) 응답 한 행. 날짜 필드는 문서에 없지만 오면 받아 둔다. */
export const lhNoticeItem = z
  .object({
    PAN_ID: z.union([z.string(), z.number()]).transform((v) => String(v).trim()),
    PAN_NM: str,
    UPP_AIS_TP_CD: str, // 01 토지 · 05 분양주택 · 06 임대주택 · 13 주거복지 · 22 상가 · 39 신혼희망타운
    UPP_AIS_TP_NM: str,
    AIS_TP_CD: str,
    AIS_TP_CD_NM: str, // 행복주택·국민임대 …
    CNP_CD: str,
    CNP_CD_NM: str, // 지역명(서울특별시 … 전국)
    PAN_SS: str, // 공고중·접수중·접수마감·상담요청·정정공고중
    PAN_NT_ST_DT: str, // 공고게시일(있으면)
    CLSG_DT: str, // 공고마감일(있으면)
    DTL_URL: str,
    ALL_CNT: str,
    RNUM: str,
  })
  .passthrough()
export type LhNoticeItem = z.infer<typeof lhNoticeItem>

const dsListShape = z.object({ dsList: z.array(lhNoticeItem).optional() }).passthrough()

/** 배열 래퍼와 객체 래퍼를 모두 dsList 하나로 편다. total은 ALL_CNT(없으면 행 수). */
export function parseLhList(json: unknown): { items: LhNoticeItem[]; total: number } {
  const parts = Array.isArray(json) ? json : [json]
  const items: LhNoticeItem[] = []
  for (const p of parts) {
    if (p && typeof p === 'object' && 'dsList' in (p as object)) items.push(...(dsListShape.parse(p).dsList ?? []))
  }
  const total = items.length ? Number(items[0].ALL_CNT ?? items.length) || items.length : 0
  return { items, total }
}
