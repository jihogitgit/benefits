import React from 'react'
import { ImageResponse } from 'next/og'
import { writeFileSync } from 'node:fs'
import { BRAND, ON_DARK, markDataUri } from '../src/components/brand/logo-mark'

/**
 * 파비콘·애플 아이콘 PNG 생성. 결과물은 커밋한다.
 *
 * app/icon.tsx로 런타임 생성할 수도 있지만 파비콘은 내용이 바뀌지 않으므로 정적 파일이 낫다.
 * 로고를 고치면 이 스크립트를 다시 돌린다 — 도형은 logo-mark.ts 한 곳에서 오므로
 * 헤더·OG와 어긋날 일이 없다.
 *
 *   npm run gen:icons
 */
async function png(size: number, radius: number, inner: number, out: string) {
  const el = React.createElement(
    'div',
    { style: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRAND.deep, borderRadius: radius } },
    React.createElement('img', { src: markDataUri(ON_DARK.body, ON_DARK.slice, inner), width: inner, height: inner, alt: '' }),
  )
  writeFileSync(out, Buffer.from(await new ImageResponse(el, { width: size, height: size }).arrayBuffer()))
  console.log(`  ${out} (${size}x${size})`)
}

async function main() {
  await png(64, 14, 52, 'src/app/icon.png')
  await png(180, 40, 148, 'src/app/apple-icon.png')
}
main().catch((e) => { console.error(e); process.exit(1) })
