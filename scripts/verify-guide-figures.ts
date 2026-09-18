/**
 * 발행된 가이드 본문이 그림에 대해 말하는 것이 실제 그림과 맞는지 운영 DB로 확인한다.
 *
 * 그림은 저장소(public/guide/*.svg)에 있고 그 그림을 설명하는 alt·캡션은 DB(guides.body_md)에
 * 있다. 둘 사이의 계약은 alt 문장뿐이어서, 그림을 고칠 때마다 조용히 끊긴다. 실제로 세로
 * 점선을 지우고 alt에 "점선이 있다"를 남겨 화면낭독기 사용자에게만 없는 요소를 읽어 주는
 * 일이 있었다. 저장소 테스트(guide-figures.test.ts)는 본문이 DB에 있어 이것을 잡을 수 없다.
 *
 * 세 가지를 본다.
 *  1) 본문이 가리키는 그림이 실린 그림인지(GUIDE_FIGURES에 있는지).
 *  2) alt가 말하는 도형(점선·화살표·사선 등)이 그 SVG에 실제로 있는지.
 *  3) alt가 말하는 수치가 그림 글자에 있는지 — 단위를 축 제목에 둔 경우가 있어 경고만 한다.
 *
 *   npm run verify:figures
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createAdminClient } from '../src/lib/supabase/admin'
import { GUIDE_FIGURES, resolveFigure } from '../src/components/benefits/guide-figures'

const DIR = join(process.cwd(), 'public/guide')

/**
 * alt에 이 낱말이 있으면 SVG에 대응하는 요소가 있어야 한다.
 * 도형을 새로 쓰기 시작하면 여기에도 넣는다 — 빠뜨리면 검사가 통과해 버린다.
 */
const SHAPES: Record<string, RegExp> = {
  점선: /stroke-dasharray/,
  사선: /<pattern/,
  화살표: /<(polygon|path)\b/,
  묶음선: /<path\b/,
  세로선: /<line/,
}

/** 본문에서 그림 한 줄을 뽑는다. Markdown.tsx의 IMG_BLOCK과 같은 모양이다. */
const FIG = /!\[([^\]]+)\]\((\/guide\/[^)\s]+)(?:\s+"([^"]*)")?\)/g

function svgText(svg: string): string {
  return [...svg.matchAll(/>([^<]+)</g)].map((m) => m[1]).join(' ').replace(/\s+/g, '')
}

async function main() {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('guides').select('slug, body_md').order('slug')
  if (error) throw error

  let problems = 0
  let figures = 0
  for (const guide of data) {
    for (const m of guide.body_md.matchAll(FIG)) {
      const [, alt, src, caption] = m
      figures += 1
      const fig = resolveFigure(src)
      if (!fig) {
        console.log(`FAIL  ${guide.slug} · ${src} — 실린 그림이 아니다`)
        problems += 1
        continue
      }
      const name = src.replace('/guide/', '')
      const svg = readFileSync(join(DIR, name), 'utf8')

      const claimed = Object.keys(SHAPES).filter((k) => alt.includes(k) || (caption ?? '').includes(k))
      const absent = claimed.filter((k) => !SHAPES[k].test(svg))
      // 단위를 축 제목에 두고 숫자만 적는 그림이 있어(예: "(만원)" + "250") 이쪽은 경고만 한다.
      const text = svgText(svg)
      const loose = [...alt.matchAll(/(\d[\d,.]*)\s*(점|만원|%|일|구간|학점|분위)/g)]
        .map((x) => x[0].replace(/\s+/g, ''))
        .filter((n) => !text.includes(n))

      const mark = absent.length ? 'FAIL ' : ' OK  '
      console.log(`${mark} ${name.padEnd(34)} ${guide.slug}`)
      if (claimed.length) console.log(`        도형 ${claimed.join('·')}${absent.length ? ` → 없음: ${absent.join('·')}` : ' → 전부 있음'}`)
      if (absent.length) problems += absent.length
      if (loose.length) console.log(`        경고: 그림 글자에 없는 수치 ${loose.join(', ')} (단위가 축 제목에 있으면 정상)`)
    }
  }

  const listed = Object.keys(GUIDE_FIGURES).length
  console.log(`\n본문 참조 ${figures}개 · 실린 그림 ${listed}장`)
  console.log(problems === 0 ? '본문과 그림이 일치' : `불일치 ${problems}건`)
  process.exitCode = problems === 0 ? 0 : 1
}

void main()
