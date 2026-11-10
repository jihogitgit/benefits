import type { Metadata } from 'next'
import Link from 'next/link'
import { siteName, absoluteUrl } from '@/lib/seo/site'
import { eunNeun, iGa } from '@/lib/korean'

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description: `${siteName()}이 어떤 정보를 다루는지(회원 정보는 수집하지 않음), 분석·광고·호스팅 사업자가 무엇을 처리하며, 이용자가 무엇을 선택할 수 있는지 밝힙니다.`,
  alternates: { canonical: absoluteUrl('/privacy') },
}

/**
 * 시행일은 처음 공개한 날, 개정일은 마지막으로 내용을 바꾼 날이다. 둘 다 손으로 적는다 —
 * 빌드 시각을 쓰면 글자 하나 안 바꾼 배포도 "개정"이 된다.
 *
 * 아래 표의 사업자 목록은 코드가 실제로 부르는 곳과 맞아야 한다:
 * GA4(layout.tsx)·AdSense·AdFit(components/ads), Vercel(호스팅), Supabase(DB),
 * Upstash(api/benefits/search의 레이트 리밋 — lib/rate-limit.ts가 IP를 키로 60초 보관).
 * 새 외부 호출을 추가하면 이 표도 같이 고친다.
 */
const EFFECTIVE = '2026-09-10'
const REVISED = '2026-11-10'

/** 검색 API 레이트 리밋 창(초). lib/rate-limit.ts를 부르는 api/benefits/search와 같은 값. */
const SEARCH_RATE_LIMIT_WINDOW_SEC = 60

const PROCESSORS: { who: string; what: string; why: string }[] = [
  { who: 'Vercel Inc.(미국)', what: '접속 로그(IP 주소, 요청 시각, 브라우저 정보)', why: '서비스 호스팅, 보안·장애 대응' },
  { who: 'Upstash Inc.(미국)', what: `검색 요청의 IP 주소 (${SEARCH_RATE_LIMIT_WINDOW_SEC}초 뒤 자동 삭제)`, why: '검색 API 남용 방지(요청 횟수 제한)' },
  { who: 'Supabase Inc.', what: '없음 (지원금·해설 데이터만 저장)', why: '데이터베이스' },
  { who: 'Google LLC', what: '쿠키, 기기·브라우저 정보, 방문 페이지, 광고 식별자', why: '이용 통계(Google Analytics 4), 광고(Google AdSense)' },
  { who: '주식회사 카카오', what: '쿠키, 광고 식별자', why: '광고(Kakao AdFit)' },
]

export default function PrivacyPage() {
  const name = siteName()
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim()
  const operator = process.env.NEXT_PUBLIC_OPERATOR_NAME?.trim()

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 prose prose-gray">
      <h1>개인정보처리방침</h1>
      <p>
        시행일: {EFFECTIVE} · 최근 개정: {REVISED}
      </p>
      <p>
        {name}(이하 &ldquo;서비스&rdquo;){operator ? `${eunNeun(name)} ${operator}${iGa(operator)} 운영하며` : eunNeun(name)} 「개인정보 보호법」을
        따릅니다. 이 방침은 서비스가 어떤 정보를 어떻게 다루는지 밝힙니다.
      </p>

      <h2>1. 서비스가 직접 수집하는 정보</h2>
      <p>
        서비스는 회원가입을 받지 않으며 회원 정보로 이름·연락처·주소를 수집하지 않습니다. 조건 진단에서 선택한
        나이대·상황·지역은 이용자의 브라우저(localStorage)에만 저장되고 서버로 전송되지 않습니다. 브라우저 데이터를
        지우면 함께 삭제됩니다.
      </p>
      <p>
        <Link href="/contact">문의하기</Link>로 보내신 이메일(보낸 사람 주소와 본문)은 답변 목적으로만 쓰고, 답변이 끝난
        뒤 1년 안에 메일함에서 삭제합니다. 그 밖에 서비스가 데이터베이스에 보관하는 개인정보는 없습니다.
      </p>

      <h2>2. 서비스 운영에 쓰는 외부 사업자</h2>
      <p>
        아래 사업자가 서비스를 운영하거나 통계·광고를 제공하는 과정에서 이용자 정보를 처리할 수 있습니다. 서비스가
        따로 모아 넘기는 개인정보는 없고, 각 사업자는 자기 방침에 따라 처리합니다. 사업자는 모두 해외 법인이거나
        해외 서버를 쓸 수 있으므로 정보가 국외에서 처리될 수 있습니다.
      </p>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>사업자</th>
              <th>처리될 수 있는 정보</th>
              <th>목적</th>
            </tr>
          </thead>
          <tbody>
            {PROCESSORS.map((p) => (
              <tr key={p.who}>
                <td>{p.who}</td>
                <td>{p.what}</td>
                <td>{p.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Google Analytics 4는 Google 태그 관리자를 통해 불러오며, Google에 따르면 GA4는 IP 주소를 기록하거나 저장하지
        않습니다. 통계는 어떤 페이지가 읽히는지 파악하는 데만 씁니다.
      </p>

      <h2>3. 쿠키와 맞춤 광고 거부</h2>
      <ul>
        <li>브라우저 설정에서 쿠키를 차단하거나 삭제할 수 있습니다. 차단해도 서비스 이용에 제한은 없습니다.</li>
        <li>
          Google 광고 설정(<a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">adssettings.google.com</a>)에서
          맞춤 광고를 끌 수 있습니다. 카카오 광고는 카카오 계정의 광고 설정에서 관리합니다.
        </li>
        <li>
          Google Analytics 수집은{' '}
          <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">
            Google Analytics 차단 브라우저 부가기능
          </a>
          으로 거부할 수 있습니다.
        </li>
      </ul>

      <h2>4. 제3자 제공</h2>
      <p>
        서비스는 이용자 정보를 제3자에게 판매하거나 제공하지 않습니다. 2항의 사업자가 처리하는 정보는 서비스 운영을
        위한 것이며, 법령에 따른 요구가 있을 때를 제외하고 다른 곳에 넘기지 않습니다.
      </p>

      <h2>5. 보유 기간</h2>
      <ul>
        <li>조건 진단 값: 이용자의 브라우저에만 있으며 이용자가 지울 때까지.</li>
        <li>문의 이메일: 답변 완료 후 1년 안에 삭제.</li>
        <li>검색 요청 IP 주소(Upstash): {SEARCH_RATE_LIMIT_WINDOW_SEC}초 뒤 자동 삭제.</li>
        <li>호스팅·분석·광고 사업자의 로그와 쿠키: 각 사업자의 방침을 따릅니다.</li>
      </ul>

      <h2>6. 이용자의 권리</h2>
      <p>
        이용자는 언제든 브라우저 데이터를 지워 진단 값을 삭제할 수 있고, 보낸 문의 이메일의 삭제를 요청할 수 있습니다.
        그 밖의 열람·정정·삭제 요청은 아래 연락처로 보내 주시면 지체 없이 처리합니다.
      </p>

      <h2>7. 개인정보 보호 책임자</h2>
      <p>
        {operator ? `책임자: ${operator}. ` : ''}
        개인정보 관련 문의와 요청은 {email ? <a href={`mailto:${email}`}>{email}</a> : <Link href="/contact">문의하기</Link>}로
        보내 주세요.
      </p>

      <h2>8. 방침 변경</h2>
      <p>
        방침을 바꾸면 이 페이지에 개정일과 함께 반영합니다. 처리하는 정보가 늘어나는 변경은 시행 전에 이 페이지 상단에
        미리 알립니다.
      </p>
    </article>
  )
}
