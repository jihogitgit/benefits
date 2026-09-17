/**
 * 애드센스 게시자 ID의 단일 출처.
 *
 * 값을 저장소에 둔다. 게시자 ID는 비밀이 아니다 — 모든 방문자에게 페이지 HTML과
 * /ads.txt로 그대로 나간다. 반면 .env*는 gitignore라 여기 두지 않으면 값이 Vercel
 * 대시보드에만 존재하고, 누가 지우거나 프로젝트를 다시 만들면 아무 에러 없이 광고만
 * 조용히 꺼진다. 스크립트 태그와 ads.txt가 같은 값을 봐야 한다는 점도 중요하다 —
 * 둘이 어긋나면 승인 후에도 노출이 0이 된다.
 *
 * 프로덕션에서만 켠다. 로컬·프리뷰에서 내가 띄운 페이지가 만드는 노출과 클릭을
 * 애드센스는 무효 트래픽으로 보고, 반복되면 계정을 정지한다. VERCEL_ENV는 빌드 때
 * 주입되므로 프로덕션 배포에서만 'production'이다.
 *
 * NEXT_PUBLIC_ADSENSE_CLIENT를 설정하면 그 값이 이긴다. 계정을 바꾸거나 프리뷰에서
 * 일부러 확인할 때 쓴다.
 */
const PUBLISHER_ID = 'ca-pub-7164262890615975'

const override = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim()

export const ADSENSE_CLIENT: string | undefined =
  override || (process.env.VERCEL_ENV === 'production' ? PUBLISHER_ID : undefined)
