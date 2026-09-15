export function siteName(): string {
  return process.env.SITE_NAME?.trim() || '내몫'
}

// ?? 가 아니라 || 를 쓴다. 빈 문자열 env를 그대로 통과시키면 canonical·사이트맵·JSON-LD가
// 상대 URL로 새어나가 색인이 깨진다(.env.local.example은 대부분의 값을 빈 칸으로 배포한다).
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, '')
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}/${path.replace(/^\/+/, '')}`
}

export const SITE_DESCRIPTION = '나이·상황·지역 조건으로 받을 수 있는 정부·지자체 지원금을 한눈에 확인하세요.'
