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

/**
 * 세그먼트×지역 페이지의 색인 임계값. 세는 대상은 **그 지역에만 있는** 지원금이다.
 *
 * 전국(ALL) 공통분을 더해서 세면 안 된다. 청년 183·출산육아 473·소상공인 478건이 모든 지역
 * 페이지에 똑같이 깔리므로 어떤 임계값이든 항상 통과하고, 판정 장치가 사실상 꺼진다.
 * 실제로 광주는 지역 전용이 1/0/0인데 전국분 덕에 3페이지가 모두 색인 대상이었다.
 * 그렇게 열면 지역명만 다른 사실상 같은 페이지 51개가 색인되는 doorway page가 된다.
 */
export const REGION_HUB_MIN_LOCAL_ITEMS = 10

export function regionHubIndexable(r: { localCount: number; description_md: string | null }): boolean {
  return r.localCount >= REGION_HUB_MIN_LOCAL_ITEMS && !!r.description_md?.trim()
}
