/**
 * 받침에 따라 갈리는 조사.
 *
 * 붙일 말이 데이터에서 온다. 비교 페이지 제목은 "출산장려금을"·"산모신생아건강관리를"처럼
 * 170가지가 생기는데, 하나로 고정하면 절반이 틀린 한국어로 발행된다. 화면에 뜨는 글이라
 * 틀리면 그대로 독자에게 보인다.
 */

const HANGUL_START = 0xac00
const HANGUL_END = 0xd7a3

/** 숫자로 끝나는 말은 읽는 소리의 받침을 본다. "1(일)"은 받침이 있고 "2(이)"는 없다. */
const DIGIT_HAS_FINAL: Record<string, boolean> = {
  '0': true, // 영
  '1': true, // 일
  '2': false, // 이
  '3': true, // 삼
  '4': false, // 사
  '5': false, // 오
  '6': true, // 육
  '7': true, // 칠
  '8': true, // 팔
  '9': false, // 구
}

/**
 * 마지막 글자에 받침이 있는가. 판단할 수 없으면 null.
 *
 * 괄호·기호로 끝나는 말이 있다("장애인활동지원(추가)"). 기호에는 소리가 없으므로 앞의
 * 글자를 본다 — 그렇게 해야 "(추가)를"이 나온다.
 */
export function hasFinalConsonant(word: string): boolean | null {
  const last = word.replace(/[^가-힣A-Za-z0-9]+$/, '').at(-1)
  if (!last) return null
  if (last in DIGIT_HAS_FINAL) return DIGIT_HAS_FINAL[last]
  const code = last.charCodeAt(0)
  if (code < HANGUL_START || code > HANGUL_END) return null
  return (code - HANGUL_START) % 28 !== 0
}

/** 받침 있으면 첫 번째, 없으면 두 번째. 판단이 안 되면 받침 없는 쪽으로 둔다. */
function pick(word: string, withFinal: string, withoutFinal: string): string {
  return hasFinalConsonant(word) === true ? withFinal : withoutFinal
}

export const eulReul = (w: string) => pick(w, '을', '를')
export const iGa = (w: string) => pick(w, '이', '가')
export const eunNeun = (w: string) => pick(w, '은', '는')
