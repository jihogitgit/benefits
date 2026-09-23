/**
 * 비교 페이지에 실을 "이 묶음 안에서 갈리는 것".
 *
 * 왜 갈리는 것만 싣는가. 「출산장려금 45건 전부가 출산·육아 조건」은 제목이 이미 말한
 * 것이라 한 글자도 보태지 못한다. 독자가 이 페이지에서만 알 수 있는 것은 **같은 이름의
 * 사업인데 지자체마다 다른 대목**뿐이다. 그래서 값이 전부이거나 전무인 축은 버리고,
 * 일부만 해당하는 축만 남긴다.
 *
 * 축을 이렇게 고른 근거는 `scripts/measure-compare-facts.ts`의 실측이다(66묶음 907건).
 * 괄호 안은 "묶음 안에서 갈리는 묶음 수".
 *
 *   apply_method    58/66   채움률 100%      ← 쓴다
 *   age_min/max     53/66   채움률  99%      ← 쓰지 않는다(아래)
 *   deadline_type   45/66   채움률  82%      ← 쓴다
 *   income_bands    32/66   채움률  25%      ← 쓴다
 *   household_types 22/66                   ← 쓰지 않는다(아래)
 *   occupations     12/66   채움률   7%      ← 너무 얇다
 *   life_stages      5/66                   ← 거의 전부 아니면 전무. 동어반복
 *
 * 나이를 쓰지 않는 이유: 값의 3분의 1이 `0~120`인데 이건 "제한 없음"을 뜻한다. 화면에
 * 범위를 적으면 제한이 있는 것처럼 읽히고, 제한 없음으로 바꿔 적으면 다시 거의 모든 줄이
 * 같은 말이 된다. 가구 유형을 쓰지 않는 이유: 갈리는 22묶음 중 다수가 「장애인」「보훈대상자」
 * 처럼 제목에 이미 들어 있는 값이라 역시 보태는 것이 없다.
 *
 * 금액은 여기서도 다루지 않는다. 총액·월액·분할이 한 열에 섞여 있어 나란히 놓는 순간
 * 서로 다른 것을 잰 값이 한 축에 선다. 근거는 components/benefits/PeerList.tsx 주석.
 */

/** 한 지원금에서 뽑아낸, 비교에 쓸 사실. 원문이 아니라 판정 결과만 담는다. */
export interface CompareFact {
  slug: string
  /** 온라인으로 신청할 수 있는가. */
  online: boolean
  /** 상시 접수인가. */
  alwaysOpen: boolean
  /** 소득 기준이 걸려 있는가. */
  incomeLimited: boolean
}

/** 원천의 apply_method 표기. '||'로 여러 개가 이어 붙는다(예: `정부24온라인신청||방문신청`). */
export function isOnline(applyMethod: string | null | undefined): boolean {
  return (applyMethod ?? '').includes('온라인신청')
}

export interface FactRow {
  slug: string
  apply_method: string | null
  deadline_type: string
  income_bands: string[]
}

export function toFact(row: FactRow): CompareFact {
  return {
    slug: row.slug,
    online: isOnline(row.apply_method),
    alwaysOpen: row.deadline_type === 'always',
    incomeLimited: row.income_bands.length > 0,
  }
}

/** 축 이름. 화면이 "이 축이 갈리는가"를 물을 때 라벨 문자열 대신 이 키로 묻는다. */
export type AxisKey = 'online' | 'alwaysOpen' | 'incomeLimited'

export interface CompareSplit {
  key: AxisKey
  /** 요약 줄에 그대로 나가는 말. 언제나 참인 쪽을 센다. */
  label: string
  count: number
  total: number
  /**
   * 목록 줄에 딱지를 붙일 때 참인 쪽에 붙일 것인가.
   *
   * 언제나 **적은 쪽**에 붙인다. 26줄 중 25줄이 상시일 때 그 25줄에 「상시」를 달면
   * 딱지가 줄을 가르지 못한다 — 다 붙어 있으니 고를 근거가 되지 않고, 정작 다른 한 줄은
   * 아무 표시 없이 묻힌다. 적은 쪽에 붙이면 딱지가 언제나 절반 이하이고, 눈에 띄는 줄이
   * 곧 남과 다른 줄이 된다.
   */
  markTrue: boolean
  /** 그 딱지에 쓸 짧은 말. markTrue에 맞춰 고른다. */
  markLabel: string
}

/**
 * 갈리는 축만 골라 문장 재료로 돌려준다.
 *
 * 경계가 닫힌 쪽(0건·전건)을 버리는 것이 이 함수의 전부다. 전건을 남기면 "26곳 모두
 * 방문 신청"처럼 사실이지만 비교가 아닌 문장이 생기고, 그런 문장이 66장에 같은 모양으로
 * 깔리면 페이지마다 다른 내용을 싣는다는 목적 자체가 없어진다.
 */
export function splitsOf(facts: readonly CompareFact[]): CompareSplit[] {
  const total = facts.length
  const axes: { key: AxisKey; label: string; of: (f: CompareFact) => boolean; yes: string; no: string }[] = [
    { key: 'online', label: '온라인 신청 가능', of: (f) => f.online, yes: '온라인', no: '방문만' },
    { key: 'alwaysOpen', label: '상시 접수', of: (f) => f.alwaysOpen, yes: '상시', no: '기한 있음' },
    { key: 'incomeLimited', label: '소득 기준 있음', of: (f) => f.incomeLimited, yes: '소득 기준', no: '소득 무관' },
  ]
  return axes
    .map((a) => {
      const count = facts.filter(a.of).length
      // 같은 수로 갈리면(13 대 13) 참인 쪽에 붙인다. 어느 쪽도 적지 않으니 말이 더 분명한
      // 쪽을 고른다 — 「온라인」이 「방문만」보다 읽는 사람이 찾는 말이다.
      const markTrue = count * 2 <= total
      return { key: a.key, label: a.label, count, total, markTrue, markLabel: markTrue ? a.yes : a.no }
    })
    .filter((s) => s.count > 0 && s.count < total)
}
