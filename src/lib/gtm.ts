/**
 * GTM 컨테이너 ID의 단일 출처. 구조와 이유가 adsense.ts와 같다.
 *
 * 값을 저장소에 둔다. 컨테이너 ID는 비밀이 아니다 — 모든 방문자에게 페이지 HTML로
 * 그대로 나간다. 반면 .env*는 gitignore라 여기 두지 않으면 값이 Vercel 대시보드에만
 * 존재하고, 누가 지우거나 프로젝트를 다시 만들면 아무 에러 없이 계측만 조용히 꺼진다.
 * 계측이 꺼진 것은 광고가 꺼진 것과 달리 화면에 아무 흔적이 없어 몇 주가 지나도 모른다.
 *
 * 프로덕션에서만 켠다. 로컬·프리뷰에서 내가 띄운 페이지가 만드는 세션과 페이지뷰가
 * GA4 속성에 그대로 쌓이면, 유입을 판단하려고 붙인 계측이 자기 트래픽을 재게 된다.
 * 태그를 고쳐서 확인할 때는 GTM 미리보기 모드를 프로덕션 주소에 붙이거나,
 * NEXT_PUBLIC_GTM_ID로 프리뷰에서만 잠시 켠다.
 */
const CONTAINER_ID = 'GTM-T3JBHJZV'

const override = process.env.NEXT_PUBLIC_GTM_ID?.trim()

export const GTM_ID: string | undefined =
  override || (process.env.VERCEL_ENV === 'production' ? CONTAINER_ID : undefined)

/**
 * 구글이 준 <head> 스니펫 그대로. 컨테이너 ID만 끼운다.
 *
 * 문자열로 두는 이유: 인라인 스크립트는 React가 head로 올려주지 않아(올려주는 것은
 * async가 붙은 src 스크립트뿐이다) 렌더 위치에 그대로 남는다. 그래서 레이아웃에서
 * body의 첫 자식으로 넣고, 그 위치가 왜 head가 아닌지는 레이아웃 주석에 적었다.
 */
export function gtmSnippet(id: string): string {
  return `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${id}');`
}

/**
 * 계측을 어느 경로로 보낼지. GTM과 gtag 직접 연결은 **동시에 켜면 안 된다** — 컨테이너 안에
 * GA4 태그를 두면 페이지뷰가 두 번 잡히고, 그 이중 계측은 GA4 화면에서 '트래픽이 늘었다'로
 * 보여 몇 주가 지나도 사고로 인지되지 않는다.
 *
 * 레이아웃의 조건식으로만 두지 않고 함수로 뺀 이유: gtag 쪽은 next/script의 afterInteractive라
 * 서버 렌더 HTML에 아무 흔적을 남기지 않아, 렌더 결과로는 '둘 중 하나만 켜졌다'를 증명할 수
 * 없다. 판정을 순수 함수로 두면 그 부분만 직접 확인할 수 있다.
 */
export function analyticsPath(env: { gtm?: string; gaId?: string }): 'gtm' | 'gtag' | 'none' {
  if (env.gtm) return 'gtm'
  if (env.gaId) return 'gtag'
  return 'none'
}
