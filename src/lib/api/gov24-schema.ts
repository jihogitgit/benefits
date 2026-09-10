import { z } from 'zod'

// odcloud 공통 응답 래퍼
export const odcloudEnvelope = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    currentCount: z.number(),
    matchCount: z.number(),
    page: z.number(),
    perPage: z.number(),
    totalCount: z.number(),
    data: z.array(item),
  })

// 빈 문자열·공백은 null로 정규화. 숫자가 와도 문자열로 취급.
const str = z
  .union([z.string(), z.number()])
  .nullable()
  .optional()
  .transform((v) => (v == null ? null : String(v).trim() || null))

// 보조금24 serviceList — API가 한글 키를 그대로 내려준다 (fixtures/gov24/serviceList.sample.json 기준).
export const serviceListItem = z
  .object({
    서비스ID: z.string(),
    서비스명: z.string(),
    서비스목적요약: str,
    서비스분야: str,
    선정기준: str,
    지원내용: str,
    지원대상: str,
    지원유형: str,
    신청기한: str,
    신청방법: str,
    접수기관: str,
    소관기관명: str,
    소관기관유형: str,
    부서명: str,
    전화문의: str,
    상세조회URL: str,
    사용자구분: str,
    등록일시: str, // 'YYYYMMDDHHmmss' (KST)
    수정일시: str, // 'YYYYMMDDHHmmss' (KST)
  })
  .passthrough()

export type ServiceListItem = z.infer<typeof serviceListItem>

// supportConditions — 서비스ID + JA로 시작하는 코드 컬럼. 값은 'Y' | null | 숫자(나이 코드).
export const supportConditionItem = z
  .object({ 서비스ID: z.string() })
  .catchall(z.union([z.string(), z.number(), z.null()]))

export type SupportConditionItem = z.infer<typeof supportConditionItem>

export const serviceListResponse = odcloudEnvelope(serviceListItem)
export const supportConditionsResponse = odcloudEnvelope(supportConditionItem)
