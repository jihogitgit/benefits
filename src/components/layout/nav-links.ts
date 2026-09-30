export interface NavLink {
  href: string
  label: string
}

/**
 * 헤더·모바일 메뉴에는 큰 갈래만 둔다. 분야(청년·출산·육아·소상공인)·생애 이벤트·마감 임박은
 * 메뉴 항목이 아니라 /benefits 안의 탭·필터·"다른 방법으로 찾기"로 들어간다. 예전에는 여덟 개를
 * 한 줄로 늘어놓아 모바일 메뉴 절반이 분야 이름이었고, 분야가 늘 때마다 메뉴가 같이 길어졌다.
 *
 * 홈은 로고로도 가지만 모바일 메뉴에서는 첫 줄에 둔다 — 로고가 링크라는 걸 모르는 사람이 많다.
 */
export const MAIN_NAV: NavLink[] = [
  { href: '/', label: '홈' },
  { href: '/benefits', label: '지원금 찾기' },
  { href: '/guide', label: '가이드' },
  { href: '/median-income', label: '중위소득 계산기' },
]

/** 데스크톱 가로줄. 홈은 로고가 맡고, 폭이 좁아 '계산기'로 줄인다. */
export const MAIN_NAV_SHORT: NavLink[] = [
  { href: '/benefits', label: '지원금 찾기' },
  { href: '/guide', label: '가이드' },
  { href: '/median-income', label: '계산기' },
]

/**
 * 푸터도 헤더와 같은 큰 갈래만 편다(홈은 로고가 맡으므로 뺀다). 분야 허브·생애 이벤트·마감 임박으로
 * 가는 내부 링크는 홈의 "분야별로 보기"와 /benefits의 탭·"다른 방법으로 찾기"가 맡는다 —
 * 크롤러가 따라갈 길은 거기서 이어진다.
 */
export const FOOTER_NAV: NavLink[] = MAIN_NAV.filter((l) => l.href !== '/')
