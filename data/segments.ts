import type { Segment } from '../src/types/database'

export interface SegmentDef {
  slug: Segment
  name: string
  sort_order: number
  description_md: string
}

export const SEGMENTS: SegmentDef[] = [
  { slug: 'youth', name: '청년', sort_order: 1, description_md: '만 19~39세 청년을 위한 취업·주거·자산형성·창업 지원금.' },
  { slug: 'parenting', name: '출산·육아', sort_order: 2, description_md: '임신·출산·영유아·아동 양육 가정을 위한 급여와 바우처.' },
  { slug: 'small_biz', name: '소상공인', sort_order: 3, description_md: '소상공인·자영업자·예비창업자를 위한 자금·경영·판로 지원.' },
  { slug: 'other', name: '기타', sort_order: 99, description_md: '' },
]
