import type { Metadata } from 'next'

export const metadata: Metadata = { title: '문의하기' }

export default function ContactPage() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || '(이메일 미설정)'
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 prose prose-gray">
      <h1>문의하기</h1>
      <p>정보 오류 신고, 제휴, 광고 문의는 아래 이메일로 보내 주세요. 영업일 기준 3일 안에 답변합니다.</p>
      <p>
        이메일: <a href={`mailto:${email}`}>{email}</a>
      </p>
      <h2>정보 오류 신고 시</h2>
      <ul>
        <li>지원금 페이지 주소</li>
        <li>잘못된 내용과 올바른 내용</li>
        <li>근거 자료(공고문 링크 등)</li>
      </ul>
    </article>
  )
}
