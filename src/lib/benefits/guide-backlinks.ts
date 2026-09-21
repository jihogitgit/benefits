/**
 * 가이드 본문이 가리킨 사업을 뒤집어 "이 사업을 다룬 가이드"를 만든다.
 *
 * 검색에서 노출되는 쪽은 상세 페이지인데(Search Console 기준 상위 세 자리가 전부 상세),
 * 가이드로 가는 길은 홈과 /guide 허브뿐이었다. 검수 상세 20건 중 본문에 가이드 링크를
 * 넣은 것이 2건이라, 정작 순위가 붙은 페이지에서 가이드로 넘어갈 수가 없었다.
 *
 * 연결표를 따로 두지 않는 이유가 둘이다. 하나는 이미 있는 사실을 두 번 적지 않기
 * 위해서다 — 가이드가 어떤 사업을 다루는지는 그 가이드가 그 사업을 링크했다는 데
 * 이미 적혀 있다. 하나는 어긋남을 만들지 않기 위해서다. 표를 따로 두면 가이드를
 * 고칠 때 표를 같이 고쳐야 하고, 빠뜨리면 없는 관계가 화면에 남는다.
 */

/** 링크 주소에서 앵커와 쿼리를 떼고 퍼센트 인코딩을 푼다. */
function normalize(raw: string): string {
  const cut = raw.split(/[#?]/)[0]
  try {
    return decodeURIComponent(cut)
  } catch {
    // 잘못 인코딩된 주소는 그대로 둔다. 여기서 던지면 가이드 한 편 때문에 색인 전체가 선다.
    return cut
  }
}

/**
 * 본문에서 링크로 쓰인 /benefit 슬러그를 모은다.
 *
 * 정규식은 Markdown.tsx의 inline()과 **같은 모양**이어야 한다. 화면에 링크로 보이는 것만
 * 관계로 세기 위해서다. 둘이 어긋나면 두 방향 다 잘못된다 — 여기가 더 너그러우면 독자에게
 * 링크로 보이지도 않는 관계가 상세 페이지에 뜨고, 여기가 더 빡빡하면 본문에 멀쩡히 걸린
 * 링크가 색인에서 빠진다.
 *
 * 그래서 두 가지를 렌더러 그대로 따른다. 느낌표가 앞에 붙은 대괄호는 링크가 아니고(그림
 * 문법), 주소에 공백이 있으면 링크가 아니다 — `[글](/benefit/x "제목")` 같은 제목 달린
 * 문법을 inline()은 링크로 만들지 않고 글자로 남긴다.
 */
const LINK = /(?<!!)\[[^\]]+\]\(([^)\s]+)\)/g

export function benefitSlugsInGuide(bodyMd: string): string[] {
  const out = new Set<string>()
  for (const m of bodyMd.matchAll(LINK)) {
    if (!m[1].startsWith('/benefit/')) continue
    const slug = normalize(m[1].slice('/benefit/'.length))
    if (slug) out.add(slug)
  }
  return [...out]
}

export interface GuideRef {
  slug: string
  title: string
}

/** 가이드 목록을 사업 슬러그 → 그 사업을 다룬 가이드로 뒤집는다. 가이드 순서는 그대로 따른다. */
export function buildGuideBacklinks(
  guides: { slug: string; title: string; body_md: string }[],
): Record<string, GuideRef[]> {
  const index: Record<string, GuideRef[]> = {}
  for (const g of guides) {
    for (const benefitSlug of benefitSlugsInGuide(g.body_md)) {
      ;(index[benefitSlug] ??= []).push({ slug: g.slug, title: g.title })
    }
  }
  return index
}
