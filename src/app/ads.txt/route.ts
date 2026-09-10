// ads.txt는 "있는데 내 퍼블리셔 ID가 없는" 상태가 파일이 아예 없는 상태보다 위험하다. Google은
// 도메인 루트의 ads.txt에 자기 ID가 없으면 광고 게재를 차단하므로, 주석만 있는 정적 파일을 배포하면
// 승인 후에도 노출이 0이 된다. 그래서 파일 대신 라우트로 두고, 클라이언트 ID가 설정되기 전에는 404를 준다.
export const dynamic = 'force-static'

export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim()
  if (!client) return new Response(null, { status: 404 })
  // AdSense가 주는 값은 'ca-pub-...' 형태지만 ads.txt 레코드에는 'pub-...'을 쓴다.
  const publisherId = client.replace(/^ca-/, '')
  return new Response(`google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
