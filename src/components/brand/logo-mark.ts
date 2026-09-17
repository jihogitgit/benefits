/**
 * 로고 심볼의 단일 출처.
 *
 * 전체 원에서 한 조각이 분리된 형태 — 서비스명 "내몫"을 그대로 그림으로 옮긴 것이다.
 * 헤더는 이 마크를 인라인 SVG로 쓰고, 파비콘·OG 이미지는 같은 값을 data URI로 쓴다
 * (next/og의 Satori는 인라인 SVG 지원이 제한적이라 img로 넣는다). 한 곳에서 나오므로
 * 탭 아이콘과 헤더가 서로 다른 그림이 되는 일이 없다.
 *
 * 좌표는 중심 (12,12) 반지름 8.6에서 10°~130° 120° 조각을 잘라내고, 그 조각을
 * 이등분선(70°) 방향으로 2.2만큼 밀어낸 값이다.
 *
 * 조각을 90°/간격 1.5로 먼저 만들었다가 키웠다. 파비콘이 실제로 그려지는 크기는 16px인데,
 * 그 크기에서 90° 조각과 1.5 간격은 형태가 뭉개져 teal 덩어리로만 보였다(16px로 실제
 * 렌더해서 확인했다). 로고는 가장 작게 쓰이는 크기에서 읽혀야 한다.
 */

/** 잘려나간 나머지(270°). 연한 톤으로 '전체'를 나타낸다. */
export const MARK_BODY = 'M12 12 L20.47 10.51 A8.6 8.6 0 1 1 6.47 5.41 Z'

/** 분리된 조각(90°) — '내 몫'. 진한 톤으로 강조한다. */
export const MARK_SLICE = 'M12 12 L20.47 10.51 A8.6 8.6 0 0 0 6.47 5.41 Z'

/** 조각을 바깥으로 밀어내는 양. 이 간격이 '분리'를 읽히게 한다. */
export const SLICE_OFFSET = { x: 0.75, y: -2.07 }

export const MARK_VIEWBOX = '0 0 24 24'

/**
 * 색을 박아 넣은 SVG 문자열. next/og처럼 React 트리를 쓸 수 없는 곳에서 data URI로 쓴다.
 * currentColor를 쓰지 않는 이유: data URI로 넘어가면 상속할 color가 없다.
 */
export function markSvg(bodyColor: string, sliceColor: string, size = 24): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}" width="${size}" height="${size}">`,
    `<path d="${MARK_BODY}" fill="${bodyColor}"/>`,
    `<g transform="translate(${SLICE_OFFSET.x} ${SLICE_OFFSET.y})"><path d="${MARK_SLICE}" fill="${sliceColor}"/></g>`,
    `</svg>`,
  ].join('')
}

/** data URI. next/og의 <img src>에 넣는다. */
export function markDataUri(bodyColor: string, sliceColor: string, size = 24): string {
  return `data:image/svg+xml;base64,${Buffer.from(markSvg(bodyColor, sliceColor, size)).toString('base64')}`
}

/** 브랜드 색(globals.css의 --color-brand-*와 같은 값). og·icon은 CSS 변수를 못 읽으므로 여기 둔다. */
export const BRAND = { deep: '#115e59', mid: '#0f766e', light: '#5eead4' } as const

/**
 * 어두운 바탕(파비콘·OG)에서 쓰는 조합. 몸통이 흰색, 분리된 조각이 밝은 teal이다.
 * 한 번 반대로 넣어 파비콘과 OG의 색이 서로 반전된 적이 있어 조합을 값으로 고정한다.
 * 흰 배경(헤더)은 Logo.tsx가 Tailwind 유틸리티로 뒤집어 쓴다(brand-600 몸통 + brand-400 조각).
 */
export const ON_DARK = { body: '#ffffff', slice: BRAND.light } as const
