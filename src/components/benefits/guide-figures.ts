/**
 * 본문에 넣을 수 있는 그림 목록과 각 그림의 원본 크기.
 *
 * 파일 이름 패턴이 아니라 실제 파일 목록을 허용목록으로 두는 이유가 둘이다.
 *
 * 하나는 오타다. 패턴만 보면 없는 파일 이름도 전부 통과해 독자에게는 깨진 이미지만 남는데,
 * 초안 생성이 자동화되어 있고 검수자는 렌더된 화면이 아니라 마크다운을 보므로 그 오타를
 * 잡을 지점이 달리 없다. 목록에 없으면 그림으로 만들지 않고 문법을 그대로 드러내 둔다.
 *
 * 하나는 자리다. 브라우저는 SVG를 내려받기 전에는 viewBox를 알 수 없어 기본 높이 150px로
 * 자리를 잡고, 파일이 도착하는 순간 아래 본문이 통째로 밀린다. 비율을 미리 알아야 그 밀림이
 * 없다 — 그래서 크기가 렌더러 쪽에 있어야 한다.
 *
 * 이 표와 public/guide의 실제 파일이 어긋나지 않는지는 __tests__/guide-figures.test.ts가 지킨다.
 */
export const GUIDE_FIGURES: Record<string, { width: number; height: number }> = {
  'birth-deadlines.svg': { width: 480, height: 272 },
  'birth-parental-leave-gap.svg': { width: 480, height: 216 },
  'kosaf-grade-threshold.svg': { width: 480, height: 230 },
  'kosaf-income-brackets.svg': { width: 480, height: 192 },
  'rent-income-bands.svg': { width: 480, height: 200 },
  'rent-income-deduction.svg': { width: 480, height: 205 },
  'smallbiz-interest-timing.svg': { width: 480, height: 250 },
  'smallbiz-repayment-choice.svg': { width: 480, height: 215 },
  'youth-challenge-350.svg': { width: 480, height: 180 },
  'youth-challenge-courses.svg': { width: 480, height: 270 },
}

/** 본문에 적힌 주소가 실린 그림을 가리키는지. 아니면 null. */
export function resolveFigure(src: string): { src: string; width: number; height: number } | null {
  const name = src.trim().replace(/^\/guide\//, '')
  if (name === src.trim()) return null // /guide/ 로 시작하지 않았다
  const size = Object.prototype.hasOwnProperty.call(GUIDE_FIGURES, name)
    ? GUIDE_FIGURES[name]
    : undefined
  return size ? { src: `/guide/${name}`, ...size } : null
}
