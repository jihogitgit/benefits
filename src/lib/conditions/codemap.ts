/**
 * 보조금24 supportConditions의 JA 코드 → 진단 필터 스키마 매핑.
 * 코드 목록은 fixtures/gov24/supportConditions.sample.json 기준이며
 * codemap-coverage.test.ts가 누락 코드를 잡아낸다.
 * 값은 'Y' 또는 null, 나이 코드(JA0110/JA0111)만 숫자.
 */
export type Mapping =
  | { kind: 'gender'; value: 'male' | 'female' }
  | { kind: 'income'; value: string }
  | { kind: 'life'; value: string }
  | { kind: 'household'; value: string }
  | { kind: 'occupation'; value: string }
  | { kind: 'ignore' }

export const AGE_MIN_CODE = 'JA0110'
export const AGE_MAX_CODE = 'JA0111'

export const CODEMAP: Record<string, Mapping> = {
  // 성별
  JA0101: { kind: 'gender', value: 'male' },
  JA0102: { kind: 'gender', value: 'female' },
  // 소득 (기준중위소득 %)
  JA0201: { kind: 'income', value: '0-50' },
  JA0202: { kind: 'income', value: '51-75' },
  JA0203: { kind: 'income', value: '76-100' },
  JA0204: { kind: 'income', value: '101-200' },
  JA0205: { kind: 'income', value: '200+' },
  // 생애주기·개인 상황
  JA0301: { kind: 'life', value: 'pre_parent' }, // 예비부모/난임
  JA0302: { kind: 'life', value: 'pregnancy' }, // 임산부
  JA0303: { kind: 'life', value: 'birth' }, // 출산/입양
  JA0313: { kind: 'occupation', value: 'farmer' }, // 농업인
  JA0314: { kind: 'occupation', value: 'fisher' }, // 어업인
  JA0315: { kind: 'occupation', value: 'livestock' }, // 축산업인
  JA0316: { kind: 'occupation', value: 'forester' }, // 임업인
  JA0317: { kind: 'life', value: 'elementary' }, // 초등학생
  JA0318: { kind: 'life', value: 'middle_school' }, // 중학생
  JA0319: { kind: 'life', value: 'high_school' }, // 고등학생
  JA0320: { kind: 'occupation', value: 'college' }, // 대학생/대학원생
  JA0322: { kind: 'ignore' }, // 해당사항 없음
  JA0326: { kind: 'occupation', value: 'worker' }, // 근로자/직장인
  JA0327: { kind: 'occupation', value: 'job_seeker' }, // 구직자/실업자
  JA0328: { kind: 'household', value: 'disabled' }, // 장애인
  JA0329: { kind: 'household', value: 'veteran' }, // 국가보훈대상자
  JA0330: { kind: 'ignore' }, // 질병/질환자
  // 가구 상황
  JA0401: { kind: 'household', value: 'multicultural' }, // 다문화가족
  JA0402: { kind: 'household', value: 'defector' }, // 북한이탈주민
  JA0403: { kind: 'household', value: 'single_parent' }, // 한부모/조손
  JA0404: { kind: 'household', value: 'single' }, // 1인가구
  // JA0410~JA0414는 원래 한 칸씩 밀려 있었다. 원천 데이터에서 역산해 바로잡았다
  // (JA04 그룹이 전부 Y가 아닌 1,470건을 표본으로, 제목이 명확한 지원금이 어떤 코드를 켜는지 확인):
  //   JA0411 → 제목에 '다자녀/셋째' 있는 8건이 100% 켬
  //   JA0412 → '무주택/월세' 1건이 100% 켬
  //   JA0413 → '귀농/귀촌/전입' 5건 중 4건(80%)이 켬
  // 밀림 때문에 다자녀 지원금 104건이 '무주택'으로 분류돼 있었고, 진단에서 무주택을 고른
  // 사용자에게 다자녀·출산 지원금이 상위로 올라왔다.
  JA0410: { kind: 'ignore' }, // 정체 불명. 희소 표본 500건에 가구유형 키워드가 없고
                              // 대상 문구가 '사회적 약자(연령·장애·빈곤 등)' 쪽이라 가구유형으로 쓰지 않는다
  JA0411: { kind: 'household', value: 'multi_child' }, // 다자녀
  JA0412: { kind: 'household', value: 'no_house' }, // 무주택세대
  JA0413: { kind: 'household', value: 'new_resident' }, // 신규전입
  JA0414: { kind: 'household', value: 'extended' }, // 확대가족(밀림 패턴상 여기가 맞다. 진단 상황에는 쓰이지 않는다)
  // 사업자 유형
  JA1101: { kind: 'occupation', value: 'small_biz' }, // 중소기업/소상공인
  JA1102: { kind: 'ignore' }, // 사회복지시설
  JA1103: { kind: 'ignore' }, // 기관/단체
  // 업종 — 세그먼트 판정에 쓰지 않음
  JA1201: { kind: 'ignore' },
  JA1202: { kind: 'ignore' },
  JA1299: { kind: 'ignore' },
  // 기업 규모/업력 — Phase 1에서는 사용하지 않음
  JA2101: { kind: 'ignore' },
  JA2102: { kind: 'ignore' },
  JA2103: { kind: 'ignore' },
  JA2201: { kind: 'ignore' },
  JA2202: { kind: 'ignore' },
  JA2203: { kind: 'ignore' },
  JA2299: { kind: 'ignore' },
}

/** 진단 UI "상황" 칩 → 조건 배열 매핑. 검색(Task 13)에서 사용. */
export const SITUATION_TO_CONDITIONS: Record<string, { life?: string[]; household?: string[]; occupation?: string[] }> = {
  pregnancy: { life: ['pre_parent', 'pregnancy', 'birth'] },
  has_child: { life: ['birth', 'elementary', 'middle_school', 'high_school'], household: ['multi_child', 'single_parent'] },
  job_seeker: { occupation: ['job_seeker'] },
  business: { occupation: ['small_biz'] },
  single: { household: ['single'] },
  no_house: { household: ['no_house'] },
  student: { occupation: ['college'] },
}
