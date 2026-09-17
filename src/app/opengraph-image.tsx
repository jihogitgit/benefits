import { ImageResponse } from 'next/og'
import { siteName, SITE_DESCRIPTION } from '@/lib/seo/site'
import { BRAND, ON_DARK, markDataUri } from '@/components/brand/logo-mark'

export const alt = '내몫 — 정부 지원금 조건별 조회'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// 배경은 브랜드 teal이다. 이전에는 인디고(#4338ca)라 사이트와 공유 카드의 색이 서로 달랐다.
export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: `linear-gradient(135deg, ${BRAND.mid}, ${BRAND.deep})`, color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <img src={markDataUri(ON_DARK.body, ON_DARK.slice, 124)} width={124} height={124} alt="" />
          <div style={{ fontSize: 88, fontWeight: 800 }}>{siteName()}</div>
        </div>
        {/* keep-all: 한글은 기본이 글자 단위 줄바꿈이라 '확인하/세요.'처럼 단어 중간에서 끊긴다.
            maxWidth로 줄 수를 고정해 어느 문구가 와도 두 줄 안에서 균형이 잡히게 한다. */}
        <div style={{ marginTop: 32, maxWidth: 900, fontSize: 34, fontWeight: 400, lineHeight: 1.45, opacity: 0.92, wordBreak: 'keep-all' }}>
          {SITE_DESCRIPTION}
        </div>
      </div>
    ),
    size,
  )
}
