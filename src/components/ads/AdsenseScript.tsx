import { ADSENSE_CLIENT } from '@/lib/adsense'

/**
 * 애드센스 스크립트. 루트 레이아웃이 아니라 페이지마다 명시적으로 넣는다(opt-in).
 *
 * 색인하지 않는 페이지에는 넣지 않는다. 상세 페이지 1만여 건 대부분은 보조금24 원문을 옮긴 것이라
 * noindex로 두는데, 레이아웃에 스크립트가 있으면 자동 광고가 그 페이지들에도 붙는다. 애드센스
 * 심사는 noindex와 무관하게 링크를 따라가므로 "가치가 별로 없는 콘텐츠에 광고를 단 사이트"로 보인다
 * (2026-10 거절 사유). 그래서 색인 판정(lib/seo/index-policy.ts)과 같은 조건으로만 켠다.
 * 새 페이지를 만들면 색인 대상일 때만 이 컴포넌트를 넣는다.
 *
 * next/script가 아니라 평범한 script 태그를 쓴다. strategy="afterInteractive"는 HTML에
 * preload 링크만 남기고 실제 태그는 하이드레이션 이후 JS로 주입하는데, 그러면 HTML만 읽는
 * 크롤러에는 스니펫이 아예 없는 것으로 보인다(애드센스 코드 스니펫 방식 사이트 확인이 이래서
 * 실패했다). React 19는 async가 붙은 script를 head로 올리고 중복도 제거하므로, 구글이 준
 * 스니펫과 같은 모양이 서버 렌더 HTML에 그대로 박힌다. 광고 로드도 하이드레이션을 기다리지
 * 않는다. 사이트 확인은 홈에서 하므로 홈에서는 빠지면 안 된다.
 */
export default function AdsenseScript() {
  if (!ADSENSE_CLIENT) return null
  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
      crossOrigin="anonymous"
    />
  )
}
