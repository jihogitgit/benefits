import type { Metadata } from 'next'
import Link from 'next/link'
import { siteName, absoluteUrl } from '@/lib/seo/site'
import { eunNeun } from '@/lib/korean'

export const metadata: Metadata = {
  title: '서비스 소개·편집 원칙',
  description: `${siteName()}이 무엇을 하는 서비스인지, 데이터가 어디서 와서 얼마나 자주 갱신되는지, 해설과 가이드를 어떤 원칙으로 만들고 검수하는지 밝힙니다.`,
  alternates: { canonical: absoluteUrl('/about') },
}

/**
 * 소개 + 편집 원칙. 해설·가이드의 바이라인(EditorialByline)이 /about#editorial로 온다.
 *
 * 운영 주체는 NEXT_PUBLIC_OPERATOR_NAME이 있을 때만 적는다. 값이 없으면 문장을 통째로 빼서
 * "(미설정)" 같은 빈칸이 공개 페이지에 나가지 않게 한다. 연락처는 /contact 한 곳에만 둔다.
 */
export default function AboutPage() {
  const name = siteName()
  const operator = process.env.NEXT_PUBLIC_OPERATOR_NAME?.trim()
  const editor = process.env.NEXT_PUBLIC_EDITOR_NAME?.trim()

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 prose prose-gray">
      <h1>{name} 소개</h1>
      <p>
        {name}{eunNeun(name)} 행정안전부 보조금24에 등록된 약 1만 건의 정부·지자체 지원금을 나이·상황·지역 조건으로 걸러
        &ldquo;내가 받을 수 있는 것&rdquo;을 한 화면에서 보여주는 서비스입니다. 공고문을 그대로 옮기는 데서 그치지
        않고, 자주 찾는 제도는 쉬운 말로 풀어 쓴 해설과 신청 순서, 자주 묻는 질문을 붙입니다. 한 제도만 봐서는
        알 수 없는 것(기관별 자격 차이, 기한을 놓치면 줄어드는 금액 등)은 가이드로 따로 씁니다.
      </p>
      {operator && (
        <p>
          운영 주체: {operator}. 문의는 <Link href="/contact">문의하기</Link> 페이지의 이메일로 받습니다.
        </p>
      )}

      <h2 id="data">데이터는 어디서 오고, 얼마나 자주 갱신되나요</h2>
      <ul>
        <li>
          <strong>원천:</strong> 공공데이터포털의 「행정안전부_대한민국 공공서비스(혜택) 정보」 API(보조금24)를
          공공누리 조건에 따라 이용합니다. 원천에 없어 사람이 직접 옮긴 제도(예: 부모급여)는 페이지 하단에 근거
          문서 링크를 따로 답니다.
        </li>
        <li>
          <strong>갱신 주기:</strong> 하루 두 번(한국시간 새벽 3시, 낮 12시) 자동 동기화합니다. 신규·변경·마감된
          지원금이 이때 반영되며, 각 페이지 하단에 최종 확인 시각을 표기합니다.
        </li>
        <li>
          <strong>원문 링크:</strong> 원천에 원문 주소가 있는 지원금은 페이지 하단에 정부24 원문 링크를 두고,
          사람이 옮긴 제도는 근거 문서 링크를 두어 직접 대조할 수 있게 합니다.
        </li>
      </ul>

      <h2 id="editorial">해설·가이드 편집 원칙</h2>
      <p>
        가이드는 {editor ? `${editor}(${name} 편집)` : `${name} 편집팀`}이 직접 씁니다. 지원금 해설은 보조금24 원문을
        바탕으로 초안을 자동으로 만든 뒤, 편집팀이 원문과 대조해 고치고 검수한 것만 게재합니다. 글마다 상단에
        검수자와 날짜를 표기합니다. 다음 원칙을 지킵니다.
      </p>
      <ol>
        <li>
          <strong>근거는 공고 원문과 소관 부처 자료.</strong> 보도자료·고시·공고문처럼 확인할 수 있는 문서만 근거로
          쓰고, 글 안에서 그 출처를 밝힙니다. 블로그·커뮤니티 글은 근거로 쓰지 않습니다.
        </li>
        <li>
          <strong>숫자는 출처가 있는 것만.</strong> 금액·기준선·기한은 근거 문서의 값을 그대로 옮기고, 추정이나
          계산값은 그렇게 표시합니다.
        </li>
        <li>
          <strong>발행 전 검수.</strong> 해설은 원문과 대조해 검수한 뒤에만 페이지에 싣고 검색엔진에 노출합니다.
          검수를 거치지 않은 초안은 페이지에 나오지 않습니다.
        </li>
        <li>
          <strong>원문이 바뀌면 다시 봅니다.</strong> 게재 후 원천 데이터가 바뀐 해설에는 &ldquo;내용 확인 중&rdquo;
          표시가 붙고, 다시 대조한 뒤 표시를 지웁니다.
        </li>
        <li>
          <strong>오류는 고치고 남깁니다.</strong> 잘못된 내용을 알게 되면 본문을 고치고 수정일을 갱신합니다.
          오류 신고는 <Link href="/contact">문의하기</Link>로 받습니다.
        </li>
      </ol>

      <h2 id="ads">광고에 대해</h2>
      <p>
        서비스는 광고(Google AdSense, Kakao AdFit) 수익으로 운영합니다. 광고는 해설이 게재된 지원금 페이지와
        가이드에만 싣고, 콘텐츠와 구분되도록 &ldquo;광고&rdquo;로 표시합니다. 광고주가 내용에 관여하지 않으며,
        특정 상품이나 기관을 광고 때문에 추천하지 않습니다.
      </p>

      <h2 id="not">하지 않는 것</h2>
      <ul>
        <li>신청을 대행하거나 자격을 판정하지 않습니다. 결과는 참고용이며 최종 확인은 공식 페이지에서 해야 합니다.</li>
        <li>회원가입을 받지 않고 회원 정보로 이름·연락처를 수집하지 않습니다. 조건 진단 값은 이용자의 브라우저에만 저장됩니다.</li>
        <li>지원금 정보를 유료로 팔거나 상담으로 연결하지 않습니다.</li>
      </ul>

      <p>
        <Link href="/contact">문의하기</Link> · <Link href="/privacy">개인정보처리방침</Link> ·{' '}
        <Link href="/terms">이용약관</Link>
      </p>
    </article>
  )
}
