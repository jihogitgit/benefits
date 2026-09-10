export function siteName(): string {
  return process.env.SITE_NAME ?? '지원금 포털'
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}/${path.replace(/^\/+/, '')}`
}

export const SITE_DESCRIPTION = '나이·상황·지역 조건으로 받을 수 있는 정부·지자체 지원금을 한눈에 확인하세요.'
