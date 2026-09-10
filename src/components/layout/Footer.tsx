import Link from 'next/link'
import { siteName } from '@/lib/seo/site'

export default function Footer() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL
  return (
    <footer className="mt-16 border-t bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-gray-500">
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/about" className="hover:text-gray-800">서비스 소개</Link>
          <Link href="/contact" className="hover:text-gray-800">문의하기</Link>
          <Link href="/privacy" className="hover:text-gray-800">개인정보처리방침</Link>
          <Link href="/terms" className="hover:text-gray-800">이용약관</Link>
        </div>
        <p>{siteName()}{email ? ` | 문의: ${email}` : ''}</p>
        <p className="mt-1">
          본 사이트는 행정안전부 보조금24 공공데이터를 가공해 제공합니다. 신청 자격과 기한은 반드시 각 지원금의 공식 페이지(정부24)에서 최종 확인하세요.
        </p>
      </div>
    </footer>
  )
}
