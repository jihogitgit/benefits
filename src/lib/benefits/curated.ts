/**
 * 원천 API에 없어 손으로 채운 행을 가리키는 값.
 *
 * 시드 데이터(data/curated-benefits.ts)와 표시 코드(SourceFooter)가 둘 다 필요로 하는데,
 * 표시 코드가 시드 데이터 모듈을 통째로 물면 상수 두 개 때문에 레코드 본문까지 번들에 딸려온다.
 */
export const CURATED_SOURCE = 'curated'

/** 확인일이 이만큼 지나면 상세 페이지가 스스로 "직접 확인해라"라고 말한다. */
export const CURATED_STALE_DAYS = 180
