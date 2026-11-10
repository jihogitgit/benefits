import type { HousingKind, HousingStatus } from '@/types/housing'

export const KIND_LABEL: Record<HousingKind, string> = {
  apt: '아파트 분양',
  apt_remainder: '무순위·잔여세대',
  officetel_etc: '오피스텔·도시형·민간임대',
  lh_sale: 'LH 분양',
  lh_rent: 'LH 임대',
  lh_welfare: 'LH 주거복지',
  newlywed_town: '신혼희망타운',
}

export const STATUS_LABEL: Record<HousingStatus, string> = {
  upcoming: '접수 예정',
  open: '접수중',
  closed: '마감',
  removed: '내려감',
}

/** /housing 필터 칩 순서. 청약홈 → LH. */
export const KIND_FILTERS: { kind: HousingKind; label: string }[] = (
  ['apt', 'apt_remainder', 'newlywed_town', 'officetel_etc', 'lh_rent', 'lh_sale', 'lh_welfare'] as const
).map((kind) => ({ kind, label: KIND_LABEL[kind] }))

export function isHousingKind(v: string | null | undefined): v is HousingKind {
  return !!v && Object.prototype.hasOwnProperty.call(KIND_LABEL, v)
}
