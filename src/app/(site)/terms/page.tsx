import type { Metadata } from 'next'
import { siteName } from '@/lib/seo/site'

export const metadata: Metadata = { title: '이용약관' }

export default function TermsPage() {
  const name = siteName()
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 prose prose-gray">
      <h1>이용약관</h1>
      <p>시행일: 2026-09-10</p>
      <h2>1. 목적</h2>
      <p>이 약관은 {name}(이하 &ldquo;서비스&rdquo;)의 이용 조건을 정합니다.</p>
      <h2>2. 서비스 내용</h2>
      <p>서비스는 공공데이터를 가공한 지원금 정보와 해설을 무료로 제공합니다. 신청 대행, 자격 판정, 상담은 제공하지 않습니다.</p>
      <h2>3. 정보의 정확성</h2>
      <p>
        서비스는 정보를 정확하게 유지하기 위해 노력하지만, 공고 변경·해석 차이로 실제와 다를 수 있습니다.
        이용자는 신청 전 공식 페이지에서 확인해야 하며, 서비스는 정보 오류로 인한 손해에 책임지지 않습니다.
      </p>
      <h2>4. 광고</h2>
      <p>서비스에는 Google AdSense, Kakao AdFit 광고가 게재됩니다. 광고 내용은 광고주의 책임입니다.</p>
      <h2>5. 지적재산권</h2>
      <p>공공데이터 원문은 해당 기관의 공공누리 조건을 따르며, 서비스가 작성한 해설은 서비스에 권리가 있습니다. 출처를 밝히면 비상업적 인용은 허용합니다.</p>
      <h2>6. 약관 변경</h2>
      <p>약관은 사전 고지 후 변경될 수 있으며, 변경 후 이용은 동의로 봅니다.</p>
    </article>
  )
}
