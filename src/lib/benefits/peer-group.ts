import { REGIONS } from '../../../data/regions'
import { SIGUNGU } from '../../../data/sigungu'

/**
 * 같은 사업을 여러 지자체가 각자 운영하는 경우를 하나로 묶는다.
 *
 * "출산장려금"은 전국 10개 시·군이 제각각 운영하고, 우리 DB에는 45건이 따로 들어 있다.
 * 독자가 한 건의 상세 페이지에서 알고 싶은 것은 "우리 동네는 얼마인가"인데, 지금은
 * 그 45건이 서로를 모른다. 제목에서 지역 표시를 걷어내면 같은 사업끼리 열쇠가 같아진다.
 *
 * 이 파일은 순수 함수만 둔다 — DB 조회는 queries.ts, 화면은 페이지가 맡는다.
 */

/** 기관명 부분 문자열 검색용. 긴 이름이 먼저 와야 "강남구"가 "남구"로 잡히지 않는다. */
const BY_LENGTH: readonly string[] = [...SIGUNGU].filter((n) => !/(도|특별시|광역시|특별자치시|특별자치도)$/.test(n)).sort((a, b) => b.length - a.length)

/** 시·도 이름. data/regions의 keywords가 "서울특별시"·"서울시"·"서울"을 모두 담고 있다. */
const SIDO: ReadonlySet<string> = new Set(REGIONS.flatMap((r) => r.keywords))

/** 괄호 한 덩이. 여는 괄호·내용·닫는 괄호를 나눠 잡는다. */
const PAREN = /[(（[]\s*([^)）\]]*?)\s*[)）\]]/g

/**
 * 가운뎃점 변종. 지우고 붙인다 — 한 글자로 통일만 하면 `산모·신생아건강관리`(40건)와
 * 아예 점을 안 쓴 `산모신생아건강관리`(4건)가 끝까지 다른 묶음으로 남는다.
 */
const MIDDLE_DOT = /[·･‧∙•・]/g

/**
 * 사업명 꼬리. "출산장려금"과 "출산장려금 지원사업", "효행장려금"과 "효행장려금 지급"은
 * 같은 것을 가리킨다. 한 번만 벗기면 "참전유공자 사망위로금 지급"이 "…위로금지급"으로
 * 남아 "…위로금"(17건)과 갈라진다. 더 벗을 것이 없을 때까지 돈다.
 */
const TAIL = /(지원사업|지원|사업|지급)$/

/**
 * 꼬리를 다 벗기고 남은 열쇠의 최소 길이. 제목이 "생활 지원"뿐이면 "생활"만 남는데,
 * 그 두 글자로 묶으면 서로 다른 사업이 한 덩이가 된다. 실제 묶음 중 가장 짧은 것이
 * "벼육묘"·"귀농인" 세 글자라 여기를 바닥으로 둔다.
 */
const MIN_KEY_LEN = 3

/**
 * 괄호 안이 지역 이름뿐인가. "경기도 광주시"·"수원시 영통구"·"송파구"는 참,
 * "다자녀가구"·"사후청구"·"청소년증 발급시"는 거짓이다.
 *
 * 어절을 전부 아는 이름과 대조한다. `[가-힣]{2,5}(?:시|군|구)` 같은 패턴으로 하면
 * 위의 거짓 셋이 전부 참이 되고, 대상이 다른 사업 둘이 한 묶음으로 합쳐진다.
 */
function isRegionOnly(inner: string): boolean {
  if (!inner) return false
  const tokens = inner.split(/\s+/)
  // 세 어절이 넘어가면 지역명이 아니라 설명이다.
  if (tokens.length > 2) return false
  return tokens.every((t) => SIGUNGU.has(t) || SIDO.has(t))
}

/**
 * 같은 사업끼리 같아지는 열쇠. 지역 괄호·공백·가운뎃점·사업명 꼬리를 지운다.
 * 너무 짧아진 열쇠는 빈 문자열로 버린다(groupPeers가 걸러낸다).
 * 지역이 괄호 없이 제목 안에 박힌 것("완도군 산모도우미")은 걷어내지 않는다 —
 * 어디까지가 지역이고 어디부터 사업명인지 가를 수 없어, 손대면 다른 사업을 합친다.
 */
export function peerKey(title: string): string {
  let key = title
    .replace(PAREN, (whole, inner: string) => (isRegionOnly(inner) ? '' : whole))
    .replace(MIDDLE_DOT, '')
    .replace(/\s+/g, '')
  for (let next = key.replace(TAIL, ''); next !== key; next = key.replace(TAIL, '')) key = next
  return key.length >= MIN_KEY_LEN ? key : ''
}

/**
 * 묶음으로 인정하는 최소 건수와 최소 지역 수.
 *
 * 지역 수를 따로 보는 이유가 있다. 건수만 세면 한 지자체가 대상별로 쪼개 등록한 사업
 * 여러 건이 "여러 곳이 하는 같은 사업"으로 보인다. 그건 비교할 것이 없다.
 */
export const PEER_MIN_ITEMS = 3
export const PEER_MIN_REGIONS = 3

/**
 * 묶음에 담는 최소 정보. 금액을 넣지 않는 것은 화면에서 안 쓰기 때문만이 아니다 —
 * amount_text는 한 행이 수백 자라, 담으면 10,483건을 실어 나르고 캐시 한 칸에 넣게 된다.
 * 금액 비교를 열 때 다시 넣되, 그때는 파싱된 수와 단위를 넣는다(원문 전체가 아니라).
 */
export interface PeerItem {
  slug: string
  title: string
  region_code: string
  agency: string | null
}

/**
 * 이 지원금을 하는 시·군·구 이름. 못 찾으면 null.
 *
 * 없으면 목록이 못 쓰게 된다. region_code는 시·도까지만 있어서, 강원의 다섯 건이 화면에
 * 「강원 · 출산장려금 지원」으로 똑같이 다섯 줄 나온다 — 독자는 자기 동네 줄을 고를 수 없고,
 * 그러면 "어디가 또 하는가"라는 이 절의 유일한 쓸모가 사라진다.
 *
 * 제목 괄호를 먼저 본다. 우리가 방금 지운 그 괄호라 어느 글자가 지역인지 이미 알고 있고,
 * 소관기관이 "○○도"까지만 적힌 행에서도 시·군이 남아 있다. 없으면 소관기관 어절을 본다.
 */
export function sigunguOf(title: string, agency: string | null | undefined): string | null {
  for (const m of title.matchAll(PAREN)) {
    if (!isRegionOnly(m[1])) continue
    const last = m[1].split(/\s+/).at(-1)!
    if (SIGUNGU.has(last) && !SIDO.has(last)) return last
  }
  const org = agency ?? ''
  for (const token of org.split(/\s+/)) {
    if (SIGUNGU.has(token) && !SIDO.has(token)) return token
  }
  // 기관명은 띄어쓰기가 없을 때가 있다("서울특별시관악구시설관리공단"). 기관명에 한해
  // 부분 문자열로도 찾는다 — 제목과 달리 고유명사만 들어 있어 낱말에 파묻힐 위험이 낮다.
  // 긴 이름부터 본다. 짧은 이름부터 보면 "강남구"가 "남구"로 잡힌다.
  for (const name of BY_LENGTH) if (org.includes(name)) return name
  return null
}

export function isPeerGroup(items: readonly PeerItem[]): boolean {
  if (items.length < PEER_MIN_ITEMS) return false
  return new Set(items.map((i) => i.region_code)).size >= PEER_MIN_REGIONS
}

/** 열쇠별로 묶고, 묶음 조건을 못 채운 것은 버린다. */
export function groupPeers(items: readonly PeerItem[]): Map<string, PeerItem[]> {
  const byKey = new Map<string, PeerItem[]>()
  for (const item of items) {
    const key = peerKey(item.title)
    if (!key) continue
    const bucket = byKey.get(key)
    if (bucket) bucket.push(item)
    else byKey.set(key, [item])
  }
  for (const [key, bucket] of byKey) if (!isPeerGroup(bucket)) byKey.delete(key)
  return byKey
}
