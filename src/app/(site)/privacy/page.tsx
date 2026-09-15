import type { Metadata } from 'next'
import Link from 'next/link'
import { siteName } from '@/lib/seo/site'

export const metadata: Metadata = { title: '개인정보처리방침' }

export default function PrivacyPage() {
  const name = siteName()
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 prose prose-gray">
      <h1>개인정보처리방침</h1>
      <p>시행일: 2026-09-10</p>
      <h2>1. 수집하는 개인정보</h2>
      <p>
        {name}(이하 &ldquo;서비스&rdquo;)은 회원가입을 받지 않으며 이름·연락처 등 개인정보를 직접 수집하지 않습니다.
        조건 진단에서 선택한 나이대·상황·지역은 이용자의 브라우저(localStorage)에만 저장되고 서버로 전송되지 않습니다.
      </p>
      <h2>2. 자동 수집 정보</h2>
      <ul>
        <li>서비스 이용 통계 분석을 위해 Google Analytics 4가 쿠키와 기기 정보를 수집할 수 있습니다.</li>
        <li>광고 제공을 위해 Google AdSense, Kakao AdFit이 쿠키 및 광고 식별자를 사용할 수 있습니다.</li>
      </ul>
      <h2>3. 쿠키 거부</h2>
      <p>브라우저 설정에서 쿠키를 차단할 수 있으며, 차단 시에도 서비스 이용에는 제한이 없습니다. Google 광고 설정(adssettings.google.com)에서 맞춤 광고를 해제할 수 있습니다.</p>
      <h2>4. 제3자 제공</h2>
      <p>서비스는 이용자 정보를 제3자에게 제공하지 않습니다. 광고·분석 사업자의 처리에 대해서는 각 사업자의 개인정보처리방침을 따릅니다.</p>
      <h2>5. 문의</h2>
      <p>개인정보 관련 문의는 <Link href="/contact">문의하기</Link> 페이지의 이메일로 보내 주세요.</p>
    </article>
  )
}
