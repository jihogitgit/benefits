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

// 실제 응답 예시가 없어 느슨하게 둔다. SS_CODE가 있고 'Y'가 아니면 오류로 본다.
const resHeaderShape = z.object({ SS_CODE: str, RS_MSG: str }).passthrough()

function checkHeaders(part: object): void {
  if (!('resHeader' in part)) return
  const raw = (part as { resHeader: unknown }).resHeader
  for (const h of Array.isArray(raw) ? raw : [raw]) {
    const r = resHeaderShape.safeParse(h)
    if (r.success && r.data.SS_CODE != null && r.data.SS_CODE !== 'Y') {
      throw new Error(`lh API 오류 ${r.data.SS_CODE}: ${r.data.RS_MSG ?? ''}`)
    }
  }
}

/**
 * 배열 래퍼와 객체 래퍼를 모두 dsList 하나로 편다.
 * total은 첫 행 ALL_CNT가 행 수 이상의 정수일 때만 믿고, 아니면 null(미상). 빈 목록은 0.
 * resHeader의 SS_CODE가 Y가 아니면 던진다(재시도 대상 아님).
 */
export function parseLhList(json: unknown): { items: LhNoticeItem[]; total: number | null } {
  const parts = Array.isArray(json) ? json : [json]
  const items: LhNoticeItem[] = []
  for (const p of parts) {
    if (!p || typeof p !== 'object') continue
    checkHeaders(p)
    if ('dsList' in p) items.push(...(dsListShape.parse(p).dsList ?? []))
  }
  if (items.length === 0) return { items, total: 0 }
  const raw = items[0].ALL_CNT
  const n = raw == null ? NaN : Number(raw)
  return { items, total: Number.isInteger(n) && n >= items.length ? n : null }
}
