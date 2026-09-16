export function siteName(): string {
  return process.env.SITE_NAME?.trim() || '내몫'
}

// ?? 가 아니라 || 를 쓴다. 빈 문자열 env를 그대로 통과시키면 canonical·사이트맵·JSON-LD가
// 상대 URL로 새어나가 색인이 깨진다(.env.local.example은 대부분의 값을 빈 칸으로 배포한다).
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, '')
}

// 경로 구간을 퍼센트 인코딩한다. 슬러그가 한글이라 그냥 두면 사이트맵 <loc>에는 한글이,
// 페이지 canonical에는 퍼센트 인코딩된 주소가 실려(Next가 metadata의 URL을 정규화한다)
// 같은 문서가 표기만 다른 두 주소로 나간다. 사이트맵 규격도 <loc>에 비ASCII를 그대로 싣는 것을
// 허용하지 않는다. 호출자는 인코딩하지 않은 경로를 넘긴다 — 이미 인코딩된 값을 넘기면 %가
// %25로 한 번 더 인코딩된다.
export function absoluteUrl(path: string): string {
  const encoded = path
    .replace(/^\/+/, '')
    .split('/')
    .map(encodeURIComponent)
    .join('/')
  return `${siteUrl()}/${encoded}`
}

export const SITE_DESCRIPTION = '나이·상황·지역 조건으로 받을 수 있는 정부·지자체 지원금을 한눈에 확인하세요.'
