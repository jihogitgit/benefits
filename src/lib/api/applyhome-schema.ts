import { z } from 'zod'
import { odcloudEnvelope } from './gov24-schema'

/**
 * 청약홈 분양정보 조회 서비스(공공데이터포털 15098547, odcloud).
 * 값은 전부 문자열로 받고 정규화(날짜·숫자)는 sync/housing-normalize.ts가 한다.
 * 실측(fixtures/housing): 날짜는 YYYY-MM-DD, MVN_PREARNGE_YM은 YYYYMM, HOUSE_SECD는 01 APT·10 신혼희망타운·
 * 04 무순위·02 오피스텔/도시형/민간임대. 숫자가 와도 문자열로 바꾼다(보조금24와 같은 str).
 */
const str = z
  .union([z.string(), z.number()])
  .nullable()
  .optional()
  .transform((v) => (v == null ? null : String(v).trim() || null))

const id = z.union([z.string(), z.number()]).transform((v) => String(v).trim())

const common = {
  HOUSE_MANAGE_NO: id, // 주택관리번호
  PBLANC_NO: id, // 공고번호
  HOUSE_NM: str, // 주택명
  HOUSE_SECD: str, // 주택구분코드
  HOUSE_SECD_NM: str,
  HOUSE_DTL_SECD: str, // 주택상세구분코드
  HOUSE_DTL_SECD_NM: str,
  RENT_SECD: str, // 분양/임대 구분
  RENT_SECD_NM: str,
  SUBSCRPT_AREA_CODE: str,
  SUBSCRPT_AREA_CODE_NM: str, // 공급지역명(시도)
  HSSPLY_ZIP: str,
  HSSPLY_ADRES: str, // 공급위치
  TOT_SUPLY_HSHLDCO: str, // 공급규모(세대)
  RCRIT_PBLANC_DE: str, // 모집공고일
  PRZWNER_PRESNATN_DE: str, // 당첨자발표일
  CNTRCT_CNCLS_BGNDE: str, // 계약 시작
  CNTRCT_CNCLS_ENDDE: str,
  MVN_PREARNGE_YM: str, // 입주예정월
  BSNS_MBY_NM: str, // 사업주체
  CNSTRCT_ENTRPS_NM: str, // 시공사
  MDHS_TELNO: str,
  HMPG_ADRES: str, // 홈페이지
  NSPRC_NM: str, // 실측 응답에 있는 필드(세 상세 응답 공통)
  PBLANC_URL: str, // 문서에는 없으나 일부 응답에 있다는 보고가 있어 받아 둔다
  SPECLT_RDN_EARTH_AT: str, // 투기과열지구
  MDAT_TRGET_AREA_SECD: str, // 조정대상지역
  PARCPRC_ULS_AT: str, // 분양가상한제
  PUBLIC_HOUSE_EARTH_AT: str, // 공공주택지구
  LRSCL_BLDLND_AT: str, // 대규모택지
  NPLN_PRVOPR_PUBLIC_HOUSE_AT: str,
  IMPRMN_BSNS_AT: str, // 정비사업
}

/** getAPTLttotPblancDetail — APT(민간사전청약·신혼희망타운 포함) */
export const aptDetailItem = z
  .object({
    ...common,
    SPSPLY_RCEPT_BGNDE: str, // 특별공급 접수
    SPSPLY_RCEPT_ENDDE: str,
    RCEPT_BGNDE: str, // 청약접수(전체)
    RCEPT_ENDDE: str,
    GNRL_RNK1_CRSPAREA_RCPTDE: str, // 1순위 해당지역 접수 시작(끝은 _ENDDE). 기타경기·기타지역도 같은 쌍
    GNRL_RNK1_CRSPAREA_ENDDE: str,
    GNRL_RNK1_ETC_GG_RCPTDE: str,
    GNRL_RNK1_ETC_GG_ENDDE: str,
    GNRL_RNK1_ETC_AREA_RCPTDE: str,
    GNRL_RNK1_ETC_AREA_ENDDE: str,
    GNRL_RNK2_CRSPAREA_RCPTDE: str,
    GNRL_RNK2_CRSPAREA_ENDDE: str,
    GNRL_RNK2_ETC_GG_RCPTDE: str,
    GNRL_RNK2_ETC_GG_ENDDE: str,
    GNRL_RNK2_ETC_AREA_RCPTDE: str,
    GNRL_RNK2_ETC_AREA_ENDDE: str,
  })
  .passthrough()
export type AptDetailItem = z.infer<typeof aptDetailItem>

/** getRemndrLttotPblancDetail — 무순위·잔여세대·계약취소 */
export const remainderDetailItem = z
  .object({
    ...common,
    SPSPLY_RCEPT_BGNDE: str,
    SPSPLY_RCEPT_ENDDE: str,
    GNRL_RCEPT_BGNDE: str, // 일반공급 접수
    GNRL_RCEPT_ENDDE: str,
    SUBSCRPT_RCEPT_BGNDE: str,
    SUBSCRPT_RCEPT_ENDDE: str,
  })
  .passthrough()
export type RemainderDetailItem = z.infer<typeof remainderDetailItem>

/** getUrbtyOfctlLttotPblancDetail — 오피스텔·도시형·민간임대·공공지원민간임대 */
export const urbtyDetailItem = z
  .object({
    ...common,
    SEARCH_HOUSE_SECD: str,
    SUBSCRPT_RCEPT_BGNDE: str,
    SUBSCRPT_RCEPT_ENDDE: str,
  })
  .passthrough()
export type UrbtyDetailItem = z.infer<typeof urbtyDetailItem>

/** getAPTLttotPblancMdl / getRemndrLttotPblancMdl — 주택형별 */
export const mdlItem = z
  .object({
    HOUSE_MANAGE_NO: id,
    PBLANC_NO: id,
    MODEL_NO: str,
    HOUSE_TY: str, // 주택형
    SUPLY_AR: str, // 공급면적
    LTTOT_TOP_AMOUNT: str, // 분양최고금액(만원)
    SUPLY_HSHLDCO: str, // 일반공급 세대수
    SPSPLY_HSHLDCO: str, // 특별공급 세대수
    NWWDS_HSHLDCO: str, // 신혼부부
    LFE_FRST_HSHLDCO: str, // 생애최초
    MNYCH_HSHLDCO: str, // 다자녀
    OLD_PARNTS_SUPORT_HSHLDCO: str, // 노부모부양
    INSTT_RECOMEND_HSHLDCO: str, // 기관추천
    TRANSR_INSTT_ENFSN_HSHLDCO: str, // 이전기관
    ETC_HSHLDCO: str,
    NWBB_HSHLDCO: str, // 신생아(실측)
    YGMN_HSHLDCO: str, // 청년(실측)
  })
  .passthrough()
export type MdlItem = z.infer<typeof mdlItem>

export const aptDetailResponse = odcloudEnvelope(aptDetailItem)
export const remainderDetailResponse = odcloudEnvelope(remainderDetailItem)
export const urbtyDetailResponse = odcloudEnvelope(urbtyDetailItem)
export const aptMdlResponse = odcloudEnvelope(mdlItem)
