import type { Segment } from '../src/types/database'

export interface SegmentDef {
  slug: Segment
  path: string // URL 세그먼트
  name: string
  sort_order: number
  description_md: string
}

export const SEGMENTS: SegmentDef[] = [
  { slug: 'youth', path: 'youth', name: '청년', sort_order: 1, description_md: '만 19~39세 청년을 위한 취업·주거·자산형성·창업 지원금.' },
  { slug: 'parenting', path: 'parenting', name: '출산·육아', sort_order: 2, description_md: '임신·출산·영유아·아동 양육 가정을 위한 급여와 바우처.' },
  { slug: 'small_biz', path: 'small-biz', name: '소상공인', sort_order: 3, description_md: '소상공인·자영업자·예비창업자를 위한 자금·경영·판로 지원.' },
  { slug: 'other', path: 'other', name: '기타', sort_order: 99, description_md: '' },
]

export const PUBLIC_SEGMENTS = SEGMENTS.filter((s) => s.slug !== 'other')
// 값은 신뢰할 수 없는 URL 세그먼트로 조회되므로 undefined를 타입에 남겨 호출자가 반드시 검사하게 한다
export const SEGMENT_BY_PATH: Record<string, SegmentDef | undefined> = Object.fromEntries(SEGMENTS.map((s) => [s.path, s]))
// SEGMENT_BY_PATH와 같은 이유로 undefined를 타입에 남긴다. benefits.segments는 CHECK 제약 없는
// text[]라 코드보다 앞선 동기화나 수동 수정으로 미지 값이 들어올 수 있고, 그때 상세 페이지가 500이 된다.
export const SEGMENT_BY_SLUG: Record<string, SegmentDef | undefined> = Object.fromEntries(SEGMENTS.map((s) => [s.slug, s]))
export const SEGMENT_OTHER: SegmentDef = SEGMENTS.find((s) => s.slug === 'other')!
export function pathOf(slug: Segment): string {
  return (SEGMENT_BY_SLUG[slug] ?? SEGMENT_OTHER).path
}
