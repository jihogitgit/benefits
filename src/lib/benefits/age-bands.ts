/** 나이대 밴드. 클라이언트 컴포넌트가 import하므로 다른 런타임 의존이 없는 leaf 모듈로 둔다. */
export const AGE_BANDS = ['10s', '20s', '30s', '40s', '50s+'] as const
export type AgeBand = (typeof AGE_BANDS)[number]
