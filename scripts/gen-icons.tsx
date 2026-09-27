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
function render(size: number, radius: number, inner: number): Promise<ArrayBuffer> {
  const el = React.createElement(
    'div',
    { style: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRAND.deep, borderRadius: radius } },
    React.createElement('img', { src: markDataUri(ON_DARK.body, ON_DARK.slice, inner), width: inner, height: inner, alt: '' }),
  )
  return new ImageResponse(el, { width: size, height: size }).arrayBuffer()
}

async function png(size: number, radius: number, inner: number, out: string) {
  writeFileSync(out, Buffer.from(await render(size, radius, inner)))
  console.log(`  ${out} (${size}x${size})`)
}

/**
 * 루트 /favicon.ico. 구글은 <link rel="icon">을 읽지만 네이버 검색결과는 루트 favicon.ico를
 * 기준으로 아이콘을 가져가는 경우가 많아, 이 파일이 404면 회색 지구본이 뜬다.
 * ICO 안에 PNG를 그대로 넣는 형식(Vista 이후 표준)이라 별도 인코더가 필요 없다.
 */
async function ico(sizes: number[], out: string) {
  const pngs = await Promise.all(sizes.map(async (s) => Buffer.from(await render(s, Math.round(s * 0.22), Math.round(s * 0.81)))))
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(pngs.length, 4)
  let offset = 6 + 16 * pngs.length
  const dir = pngs.map((buf, i) => {
    const e = Buffer.alloc(16)
    e.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], 0) // 0은 256px
    e.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], 1)
    e.writeUInt16LE(1, 4) // color planes
    e.writeUInt16LE(32, 6) // bits per pixel
    e.writeUInt32LE(buf.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += buf.length
    return e
  })
  writeFileSync(out, Buffer.concat([header, ...dir, ...pngs]))
  console.log(`  ${out} (${sizes.join(', ')})`)
}

async function main() {
  await png(64, 14, 52, 'src/app/icon.png')
  await png(180, 40, 148, 'src/app/apple-icon.png')
  await ico([16, 32, 48], 'src/app/favicon.ico')
}
main().catch((e) => { console.error(e); process.exit(1) })
