/** 한글을 유지하는 URL slug. 공백·하이픈은 하나의 하이픈으로, 그 외 기호는 제거. 최대 60자. */
export function slugify(title: string): string {
  return title
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/g, '')
}

/** used에 없는 slug를 고른다. 충돌하면 -2, -3 … 접미. 선택된 slug는 used에 추가된다. */
export function allocateSlug(base: string, used: Set<string>): string {
  let candidate = base
  let n = 2
  while (used.has(candidate)) {
    candidate = `${base}-${n}`
    n++
  }
  used.add(candidate)
  return candidate
}
