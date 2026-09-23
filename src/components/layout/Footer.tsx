import Link from 'next/link'
import { siteName } from '@/lib/seo/site'
import { NAV_LINKS } from './nav-links'

/** 원문 데이터 제공처. 출처 표기와 공공누리 고지가 같은 값을 쓰도록 한 곳에 둔다. */
const SOURCE = '공공데이터포털(data.go.kr) · 행정안전부 보조금24'

export default function Footer() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL
  const name = siteName()
  // 정적 페이지는 빌드 시점, ISR 페이지는 재검증 시점의 연도가 박힌다. 해가 바뀌어도
  // 다음 배포나 재검증에서 저절로 맞춰지므로 손으로 고칠 일이 없다.
  const year = new Date().getFullYear()

  return (
    <footer className="mt-16 border-t bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-gray-600">
        {/* 헤더가 좁은 화면에서 접는 목록을 여기서 다시 편다. 푸터는 폭 제약이 없으므로
            어느 화면에서나 모든 허브로 가는 길이 여기 하나는 남는다. */}
        <nav aria-label="사이트 메뉴" className="mb-5 flex flex-wrap gap-x-6 gap-y-1">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="inline-flex min-h-11 items-center font-medium text-gray-800 hover:text-brand-700">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="mb-5 flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/about" className="hover:text-gray-800">서비스 소개</Link>
          <Link href="/contact" className="hover:text-gray-800">문의하기</Link>
          <Link href="/privacy" className="hover:text-gray-800">개인정보처리방침</Link>
          <Link href="/terms" className="hover:text-gray-800">이용약관</Link>
          <a href="https://www.gov.kr" target="_blank" rel="noopener noreferrer" className="hover:text-gray-800">
            정부24에서 신청하기
          </a>
        </div>

        <p className="text-gray-600">
          © {year} {name}. All rights reserved.
          {email ? <> · 문의: <a href={`mailto:${email}`} className="hover:text-gray-800">{email}</a></> : null}
        </p>

        <p className="mt-3 leading-relaxed">
          본 서비스의 정보는 {SOURCE} 자료를 가공한 참고용 정보입니다. 신청 자격·지원 금액·접수 기한은 수시로 바뀌므로,
          반드시 각 지원금의 공식 페이지(정부24)에서 최종 확인하세요. {name}은 지원금을 직접 심사하거나 지급하지 않으며,
          제공한 정보로 인한 결과에 대해 책임지지 않습니다.
        </p>

        {/* gray-400은 흰 배경 대비 2.6:1로 AA(4.5:1)에 못 미친다. 보조 문구라도 글자는 글자다. */}
        <p className="mt-2 text-xs leading-relaxed text-gray-500">
          {SOURCE} 자료를{' '}
          <a
            href="https://www.kogl.or.kr/info/license.do"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600"
          >
            공공누리(KOGL)
          </a>{' '}
          조건에 따라 이용합니다 · 데이터셋별 출처는 각 상세페이지 참조
        </p>
      </div>
    </footer>
  )
}
