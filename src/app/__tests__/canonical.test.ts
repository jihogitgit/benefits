import { describe, it, expect } from 'vitest'
import { resolveRelativeUrl } from 'next/dist/lib/metadata/resolvers/resolve-url'

// layout.tsx의 alternates.canonical = './' 는 "각 페이지가 자기 자신을 가리킨다"에 의존한다.
// 이건 URL 표준의 상대경로 해석이 아니라 Next 내부가 path.posix.resolve를 쓰기 때문에 나오는
// 동작이고, 공개 계약이 아니다. 표준대로 바뀌면 './' + '/about'이 '/'로 풀려서 전 페이지가
// 홈을 canonical로 지목하게 된다 — 빌드도 타입체크도 통과하는 조용한 색인 붕괴다.
//
// 그래서 의존하는 동작을 여기서 직접 고정한다. Next 업그레이드로 이 파일이 import 실패나
// 단언 실패를 내면 그건 버그가 아니라 알람이다. layout.tsx의 canonical 출력을 실제 빌드로
// 다시 확인하고, 필요하면 절대 URL 방식으로 바꿔야 한다.
describe('canonical 상대경로 해석', () => {
  it("'./'는 현재 경로 자신으로 풀린다 (상위 경로로 올라가지 않는다)", () => {
    expect(resolveRelativeUrl('./', '/')).toBe('/')
    expect(resolveRelativeUrl('./', '/about')).toBe('/about')
    expect(resolveRelativeUrl('./', '/youth/seoul')).toBe('/youth/seoul')
    expect(resolveRelativeUrl('./', '/benefit/some-slug')).toBe('/benefit/some-slug')
  })

  // 홈이 './'를 쓰면 안 되는 이유. Vercel에서 revalidate로 홈을 다시 렌더할 때 넘어오는 경로가
  // '/'가 아니라 '/index'였고, 그 결과 canonical이 naemok.com/index로 나갔다. 빌드 시점 HTML은
  // 멀쩡해서 로컬·프리뷰에서는 재현되지 않는다. 그래서 (site)/page.tsx는 canonical을 명시한다.
  it("'/index'가 넘어오면 './'는 홈이 아닌 /index를 가리킨다", () => {
    expect(resolveRelativeUrl('./', '/index')).toBe('/index')
  })

  it('절대 경로·절대 URL은 그대로 통과한다 (페이지가 지정한 canonical 보존)', () => {
    expect(resolveRelativeUrl('/youth', '/benefit/x')).toBe('/youth')
    expect(resolveRelativeUrl('https://naemok.com/youth', '/benefit/x')).toBe('https://naemok.com/youth')
  })
})
