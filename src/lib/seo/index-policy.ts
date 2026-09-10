/** 색인 여부는 이 파일에서만 결정한다. 페이지 robots 메타와 사이트맵이 모두 이 함수를 따른다. */

export interface ArticleFlags {
  review_status: string
  indexable: boolean
}

export function benefitIndexable(b: { status: string; article: ArticleFlags | null }): boolean {
  if (b.status !== 'open') return false
  if (!b.article) return false
  // published 후 원천이 바뀐 stale은 색인을 유지한다(페이지에 "내용 확인 중" 배지)
  return b.article.indexable && (b.article.review_status === 'published' || b.article.review_status === 'stale')
}

export function hubIndexable(): boolean {
  return true
}

export const REGION_HUB_MIN_ITEMS = 3

export function regionHubIndexable(r: { count: number; description_md: string | null }): boolean {
  return r.count >= REGION_HUB_MIN_ITEMS && !!r.description_md?.trim()
}
