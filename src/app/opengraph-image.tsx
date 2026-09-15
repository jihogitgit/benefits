import { ImageResponse } from 'next/og'
import { siteName, SITE_DESCRIPTION } from '@/lib/seo/site'

export const alt = '내몫 — 정부 지원금 조건별 조회'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: 'linear-gradient(135deg,#4338ca,#6366f1)', color: 'white', fontSize: 64, fontWeight: 800 }}>
        <div>{siteName()}</div>
        <div style={{ marginTop: 24, fontSize: 32, fontWeight: 400, opacity: 0.9 }}>{SITE_DESCRIPTION}</div>
      </div>
    ),
    size,
  )
}
