import type { Metadata } from 'next'
import Link from 'next/link'
import { siteName, absoluteUrl } from '@/lib/seo/site'
import { eunNeun, iGa } from '@/lib/korean'

export const metadata: Metadata = {
  title: '문의하기',
  description: '정보 오류 신고, 정정 요청, 제휴·광고 문의를 받는 곳입니다. 영업일 기준 3일 안에 답합니다.',
  alternates: { canonical: absoluteUrl('/contact') },
}

export default function ContactPage() {
  const name = siteName()
  // 미설정 시 mailto:(이메일 미설정) 같은 깨진 링크를 만들지 않는다. 애드센스 심사는 동작하는
  // 연락 수단을 보므로, 값이 없으면 링크 대신 안내 문구를 노출해 문제를 눈에 보이게 남긴다.
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim()
  const operator = process.env.NEXT_PUBLIC_OPERATOR_NAME?.trim()

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 prose prose-gray">
      <h1>문의하기</h1>
      <p>
        {operator ? `${name}${eunNeun(name)} ${operator}${iGa(operator)} 운영합니다. ` : ''}
        정보 오류 신고, 정정 요청, 제휴·광고 문의는 아래 이메일로 보내 주세요. 영업일 기준 3일 안에 답변합니다.
      </p>
      <p>
        이메일:{' '}
        {email ? <a href={`mailto:${email}`}>{email}</a> : <span>준비 중입니다. 잠시 후 다시 확인해 주세요.</span>}
      </p>

      <h2>정보 오류·정정 요청</h2>
      <p>아래를 함께 보내 주시면 바로 확인할 수 있습니다.</p>
      <ul>
        <li>지원금 또는 가이드 페이지 주소</li>
        <li>잘못된 내용과 올바른 내용</li>
        <li>근거 자료(공고문·보도자료 링크 등)</li>
      </ul>
      <p>
        확인되면 본문을 고치고 해당 글의 수정일을 갱신합니다. 원천(보조금24) 데이터 자체가 틀린 경우는 소관 기관에
        정정을 요청해야 하므로, 그 사실을 알려 드리고 페이지에는 확인된 범위에서 안내를 덧붙입니다. 편집 기준은{' '}
        <Link href="/about#editorial">편집 원칙</Link>에 있습니다.
      </p>

      <h2>제휴·광고</h2>
      <p>
        광고는 Google AdSense와 Kakao AdFit을 통해서만 게재하며 글 내용에 광고주가 관여하지 않습니다. 기관·단체의
        공익 목적 안내(공고 게재 요청 등)는 이메일로 보내 주시면 검토합니다.
      </p>

      <h2>보내실 때 유의할 점</h2>
      <ul>
        <li>{name}{eunNeun(name)} 신청을 대행하지 않습니다. 신청 진행 상황이나 지급 여부는 해당 기관에 문의해 주세요.</li>
        <li>주민등록번호·계좌번호 같은 개인정보는 보내지 마세요. 답변에 필요하지 않습니다.</li>
      </ul>
    </article>
  )
}
