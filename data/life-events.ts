/**
 * 생애 이벤트 랜딩.
 *
 * 사람들이 실제로 치는 말은 "출산하면 받는 돈", "퇴사하면 받는 것"처럼 사건이다. 사이트는
 * 나이·상황·지역 칩으로 받고 있어 그 말과 맞물리는 자리가 없었다.
 *
 * 열지 않은 이벤트가 더 많다. 원천(보조금24) 조건 코드가 덮는 범위를 먼저 셌고
 * (docs/seo-backlog.md 7절), 코드로 뒷받침되는 것만 넣었다:
 *
 *   life_stages   birth 766 · high_school 736 · middle_school 612 · elementary 550 ·
 *                 pregnancy 319 · pre_parent 154
 *   occupations   job_seeker 314
 *
 * 퇴사·폐업·장례·암진단은 대응 코드가 아예 없다. 제목 문자열로 긁어 만들 수는 있지만
 * 그러면 조건 매칭이 아니라 낱말 맞히기가 되고, 페이지는 "이 사건에 해당하는 지원금"이라고
 * 말하면서 실제로는 낱말이 들어간 공고를 늘어놓게 된다. 근거가 생기기 전에는 열지 않는다.
 *
 * 각 항목의 situations는 SITUATION_TO_CONDITIONS의 키다 — 진단·검색과 같은 어휘를 쓰므로
 * 랜딩에서 넘어간 사용자가 홈에서 조건을 다시 고를 필요가 없다.
 */

export interface LifeEvent {
  slug: string
  /** 화면 제목. 사건을 사람 말로 적는다. */
  title: string
  /** 검색어에 가까운 한 줄. metadata description에 쓴다. */
  description: string
  /** 진단 어휘(SITUATION_TO_CONDITIONS의 키). 비면 조건 없이 전체를 보여준다. */
  situations: string[]
  /** 함께 걸 나이대. 없으면 나이로 거르지 않는다. */
  ageBand?: string
  /** 순서대로 할 일. 각 줄은 사실만 적고, 금액·기한은 적지 않는다(공고마다 다르다). */
  steps: string[]
}

export const LIFE_EVENTS: LifeEvent[] = [
  {
    slug: 'birth',
    title: '아이가 태어났을 때',
    description: '출산 후 신청할 수 있는 지원금을 한 번에 봅니다. 회원가입 없이 조건만 고르면 됩니다.',
    situations: ['pregnancy', 'has_child'],
    steps: [
      '출생신고를 합니다. 주민센터 방문 또는 정부24 온라인.',
      '출생신고와 함께 첫만남이용권·부모급여·아동수당을 한 번에 신청합니다(행복출산 원스톱).',
      '지자체 출산지원금은 별도입니다. 사는 곳에 따라 있고 없고가 갈립니다.',
      '건강보험 피부양자 등록과 예방접종 일정을 확인합니다.',
    ],
  },
  {
    slug: 'pregnancy',
    title: '임신했을 때',
    description: '임신 중 신청할 수 있는 지원금과 바우처를 모았습니다.',
    situations: ['pregnancy'],
    steps: [
      '산부인과에서 임신확인서를 받습니다.',
      '임신·출산 진료비 바우처를 신청합니다(국민행복카드).',
      '근로자라면 임신기 근로시간 단축을 쓸 수 있는지 확인합니다.',
      '지자체 임산부 교통비·영양제 지원은 지역마다 다릅니다.',
    ],
  },
  {
    slug: 'school',
    title: '아이가 학교에 갈 때',
    description: '초·중·고 자녀를 둔 가구가 신청할 수 있는 교육·돌봄 지원금입니다.',
    situations: ['has_child'],
    steps: [
      '교육급여·교육활동지원비 대상인지 확인합니다(중위소득 50% 이하).',
      '입학준비금은 지자체 사업이라 사는 곳에 따라 있습니다.',
      '방과후·돌봄 바우처와 급식비 지원을 함께 확인합니다.',
    ],
  },
  {
    slug: 'job-seeking',
    title: '일자리를 찾고 있을 때',
    description: '구직 중에 신청할 수 있는 수당·훈련비·창업 지원을 모았습니다.',
    situations: ['job_seeker'],
    steps: [
      '고용보험 이력이 있으면 실업급여 수급 자격을 먼저 확인합니다.',
      '없거나 끝났다면 국민취업지원제도를 봅니다(중위소득 60% 이하 유형과 그 밖 유형이 다릅니다).',
      '내일배움카드로 훈련비를 받을 수 있습니다.',
      '지자체 청년수당·구직활동비는 지역마다 이름과 조건이 다릅니다.',
    ],
  },
]

export const LIFE_EVENT_BY_SLUG: Record<string, LifeEvent | undefined> = Object.fromEntries(
  LIFE_EVENTS.map((e) => [e.slug, e]),
)
