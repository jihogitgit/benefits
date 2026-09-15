/**
 * 검색어 텍스트 처리. 검색 실행(searchBenefits)과 분리해 둔다.
 * 클라이언트의 진단 저장소(lib/diagnosis/storage)도 같은 정규화를 써야 하는데,
 * 그것 하나 때문에 검색 구현 전체와 지역·조건 데이터가 클라이언트 번들에 딸려오면 안 된다.
 */

/** 검색어 최대 길이(코드 포인트 기준). 이보다 길면 오타이거나 붙여넣기 사고다. */
export const Q_MAX_LEN = 40
/** AND로 묶을 토큰 상한. 토큰 하나가 필터 하나라 제한이 없으면 쿼리가 무한정 길어진다. */
export const Q_MAX_TOKENS = 4

/**
 * 검색어에서 문자·숫자·공백만 남긴다.
 * PostgREST의 or() 필터는 쉼표·괄호·따옴표·콜론을 문법으로 읽고 ILIKE는 %·_를 와일드카드로 읽는다.
 * 이스케이프를 두 겹으로 쌓다 한쪽을 빠뜨리면 필터가 조용히 어긋나므로, 위험한 문자를 아예
 * 들이지 않는 쪽을 택한다. 지원금 이름 검색에 기호가 필요한 경우는 없어 잃는 것도 없다.
 *
 * cacheKeyFor가 ':'로 필드를 잇는 것도 이 정규화에 기대고 있다. 허용 문자를 넓히려면
 * 캐시 키 구분자부터 바꿔야 한다. 넓히면서 이걸 놓치면 서로 다른 검색이 같은 키를 쓴다.
 */
export function normalizeQuery(raw: string | null | undefined): string {
  if (!raw) return ''
  const cleaned = raw
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // 코드 포인트 단위로 자른다. String.slice는 UTF-16 코드 유닛을 세기 때문에 astral plane
  // 문자(CJK 확장 B 등)가 경계에 걸리면 서로게이트 페어를 반토막 내고, 그 조각이 URL 직렬화에서
  // U+FFFD로 바뀌어 클라이언트가 아는 검색어와 서버가 실제로 찾는 문자열이 갈라진다.
  return [...cleaned].slice(0, Q_MAX_LEN).join('').trim()
}

/** 정규화된 검색어를 토큰으로. 정규화를 거치지 않은 문자열이 들어와도 안전하도록 다시 정규화한다. */
export function queryTokens(q: string): string[] {
  const n = normalizeQuery(q)
  return n ? n.split(' ').slice(0, Q_MAX_TOKENS) : []
}
