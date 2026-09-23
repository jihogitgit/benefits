import { PUBLIC_SEGMENTS } from '../../../data/segments'

export interface NavLink {
  href: string
  label: string
}

/**
 * 헤더(데스크톱 줄·모바일 메뉴)와 푸터가 같은 목록을 쓴다. 한 곳에서만 고치면
 * 세 자리가 함께 움직인다. 예전에는 헤더에만 있고 푸터에는 없어서, 모바일에서
 * 헤더가 감춘 /guide·/deadline로 갈 길이 사이트 전체에서 사라졌다.
 */
export const NAV_LINKS: NavLink[] = [
  ...PUBLIC_SEGMENTS.map((s) => ({ href: `/${s.path}`, label: `${s.name} 지원금` })),
  { href: '/life', label: '생애 이벤트로 찾기' },
  { href: '/median-income', label: '중위소득 계산기' },
  { href: '/guide', label: '가이드' },
  { href: '/deadline', label: '마감 임박' },
]

/** 헤더 가로줄은 폭이 좁아 '지원금'을 뗀 짧은 이름을 쓴다. */
export const NAV_LINKS_SHORT: NavLink[] = [
  ...PUBLIC_SEGMENTS.map((s) => ({ href: `/${s.path}`, label: s.name })),
  { href: '/life', label: '생애 이벤트' },
  { href: '/median-income', label: '중위소득' },
  { href: '/guide', label: '가이드' },
  { href: '/deadline', label: '마감 임박' },
]
