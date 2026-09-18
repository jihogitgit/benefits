/** 나이대 밴드. 클라이언트 컴포넌트가 import하므로 다른 런타임 의존이 없는 leaf 모듈로 둔다. */
export const AGE_BANDS = ['10s', '20s', '30s', '40s', '50s+'] as const
export type AgeBand = (typeof AGE_BANDS)[number]

/**
 * 가장 어린 밴드의 하한. 진단이 묻는 나이는 10대부터다.
 *
 * 이 값이 '신청자 나이로 읽을 수 있는 구간'의 경계가 된다. 원천은 JA0110/JA0111에
 * '대상자' 나이를 담는데 영유아 사업은 그 대상자가 아이라, 상한이 이 값보다 작으면
 * 어떤 밴드와도 겹치지 않는다. 판정(matchesConditions)과 SQL 필터(conditionFilters)가
 * 같은 값을 써야 둘이 갈라지지 않으므로 여기 한 곳에서만 정한다.
 */
export const YOUNGEST_BAND_FLOOR = 10
