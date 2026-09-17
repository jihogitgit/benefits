import { MARK_BODY, MARK_SLICE, MARK_VIEWBOX, SLICE_OFFSET } from './logo-mark'

/**
 * 헤더용 로고 마크. 색은 Tailwind 유틸리티로 받아 테마를 따르게 한다
 * (파비콘·OG는 CSS를 못 쓰므로 logo-mark.ts의 BRAND 값을 직접 쓴다).
 */
export default function LogoMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} className={className} aria-hidden="true" focusable="false">
      <path d={MARK_BODY} className="fill-brand-600" />
      <g transform={`translate(${SLICE_OFFSET.x} ${SLICE_OFFSET.y})`}>
        <path d={MARK_SLICE} className="fill-brand-400" />
      </g>
    </svg>
  )
}
