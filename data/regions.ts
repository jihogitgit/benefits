export interface RegionDef {
  code: string // 행정표준코드 앞 2자리
  slug: string
  name: string
  keywords: string[] // 소관기관명 첫 어절에서 매칭할 문자열
}

export const REGIONS: RegionDef[] = [
  { code: '11', slug: 'seoul', name: '서울', keywords: ['서울특별시', '서울시', '서울'] },
  { code: '26', slug: 'busan', name: '부산', keywords: ['부산광역시', '부산시', '부산'] },
  { code: '27', slug: 'daegu', name: '대구', keywords: ['대구광역시', '대구시', '대구'] },
  { code: '28', slug: 'incheon', name: '인천', keywords: ['인천광역시', '인천시', '인천'] },
  { code: '29', slug: 'gwangju', name: '광주', keywords: ['광주광역시', '광주시'] },
  { code: '30', slug: 'daejeon', name: '대전', keywords: ['대전광역시', '대전시', '대전'] },
  { code: '31', slug: 'ulsan', name: '울산', keywords: ['울산광역시', '울산시', '울산'] },
  { code: '36', slug: 'sejong', name: '세종', keywords: ['세종특별자치시', '세종시', '세종'] },
  { code: '41', slug: 'gyeonggi', name: '경기', keywords: ['경기도', '경기'] },
  { code: '51', slug: 'gangwon', name: '강원', keywords: ['강원특별자치도', '강원도', '강원'] },
  { code: '43', slug: 'chungbuk', name: '충북', keywords: ['충청북도', '충북'] },
  { code: '44', slug: 'chungnam', name: '충남', keywords: ['충청남도', '충남'] },
  { code: '52', slug: 'jeonbuk', name: '전북', keywords: ['전북특별자치도', '전라북도', '전북'] },
  { code: '46', slug: 'jeonnam', name: '전남', keywords: ['전라남도', '전남'] },
  { code: '47', slug: 'gyeongbuk', name: '경북', keywords: ['경상북도', '경북'] },
  { code: '48', slug: 'gyeongnam', name: '경남', keywords: ['경상남도', '경남'] },
  { code: '50', slug: 'jeju', name: '제주', keywords: ['제주특별자치도', '제주도', '제주'] },
]

export const REGION_ALL = 'ALL'
