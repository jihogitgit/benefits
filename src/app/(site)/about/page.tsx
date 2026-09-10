import type { Metadata } from 'next'
import Link from 'next/link'
import { siteName } from '@/lib/seo/site'

export const metadata: Metadata = { title: '서비스 소개', description: '정부·지자체 지원금을 조건별로 찾아주는 서비스 소개' }

export default function AboutPage() {
  const name = siteName()
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 prose prose-gray">
      <h1>{name} 소개</h1>
      <p>
        {name}은 행정안전부 보조금24에 등록된 약 1만 건의 정부·지자체 지원금을 나이·상황·지역 조건으로 걸러
        &ldquo;내가 받을 수 있는 것&rdquo;을 한 화면에서 보여주는 서비스입니다. 어려운 공고문을 쉬운 말로 풀어 쓰고,
        신청 순서와 자주 묻는 질문을 함께 정리합니다.
      </p>
      <h2>데이터는 어디서 오나요</h2>
      <p>
        공공데이터포털의 「행정안전부_대한민국 공공서비스(혜택) 정보」 API를 매일 2회 동기화합니다.
        각 지원금 페이지 하단에 최종 확인 시각과 원문 링크를 표기합니다. 해설 콘텐츠는 원문을 근거로 초안을 만들고 사람이 검수한 뒤 게재합니다.
      </p>
      <h2>주의사항</h2>
      <p>
        지원 자격·금액·기한은 기관 사정에 따라 바뀔 수 있습니다. 신청 전 반드시 공식 페이지에서 최종 확인하세요.
        {name}은 신청을 대행하지 않으며 개인정보를 요구하지 않습니다.
      </p>
      <h2>수익 모델</h2>
      <p>서비스는 광고(Google AdSense, Kakao AdFit)로 운영됩니다. 광고는 콘텐츠와 구분해 &ldquo;광고&rdquo;로 표시합니다.</p>
      <p><Link href="/contact">문의하기</Link></p>
    </article>
  )
}
