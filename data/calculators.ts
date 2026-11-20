/** 계산기 목록(/calc 모음 페이지). 계산기를 더하면 여기에 넣고, 사이트맵(sitemap-entries.ts)과 llms.txt에도 주소를 더한다. */
export interface CalculatorEntry {
  href: string
  title: string
  description: string
  /** 숫자의 기준(카드에 작게 표시). */
  basis: string
}

export const CALCULATORS: CalculatorEntry[] = [
  {
    href: '/median-income',
    title: '기준 중위소득 계산기',
    description: '가구원 수와 월 소득을 넣으면 중위소득의 몇 %인지 계산하고, 그 구간에서 신청할 수 있는 지원금으로 이어집니다.',
    basis: '2026년 보건복지부 고시',
  },
  {
    href: '/child-welcome',
    title: '아이맞이지원금·아동기본수당 계산기',
    description: '2027년 7월 이후 태어나는 아이가 12세까지 받는 금액을 출생 순위·지역·보육 방식별로 계산하고 지금 제도와 비교합니다.',
    basis: '2027년 개편안(정부안) · 보건복지부 2026.8.28 발표',
  },
]
