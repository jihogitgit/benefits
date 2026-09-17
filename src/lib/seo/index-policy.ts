/** 색인 여부는 이 파일에서만 결정한다. 페이지 robots 메타와 사이트맵이 모두 이 함수를 따른다. */

export interface ArticleFlags {
  review_status: string
  indexable: boolean
}

/**
 * 색인을 유지하는 검수 상태. published 후 원천이 바뀐 stale도 포함한다
 * (페이지에 "내용 확인 중" 배지가 붙고 색인은 그대로 둔다).
 *
 * 상수로 뽑아 둔 이유: 이 목록을 SQL where절에도 그대로 넘겨야 하기 때문이다.
 * 판정을 JS에서만 하면 DB가 LIMIT을 색인 대상이 아닌 행에까지 써버려, 초안이 쌓였을 때
 * 발행분이 조용히 잘려나간다(queries.ts의 listWithArticles 참고).
 */
export const INDEXABLE_REVIEW_STATUSES = ['published', 'stale'] as const

export function benefitIndexable(b: { status: string; article: ArticleFlags | null }): boolean {
  if (b.status !== 'open') return false
  if (!b.article) return false
  return b.article.indexable && (INDEXABLE_REVIEW_STATUSES as readonly string[]).includes(b.article.review_status)
}

export function hubIndexable(): boolean {
  return true
}

/**
 * 가이드는 발행된 것만 색인한다.
 * /guide/[slug] 페이지가 published_at이 없으면 notFound()를 내므로, 이 기준이 어긋나면
 * 사이트맵이 404를 신고하게 된다. 페이지와 사이트맵이 같은 함수를 보게 여기에 둔다.
 */
export function guideIndexable(g: { published_at: string | null }): boolean {
  return !!g.published_at
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
