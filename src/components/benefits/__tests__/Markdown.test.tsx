import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Markdown from '../Markdown'

describe('Markdown — 기존 회귀 (덮어쓰기 전부터 있던 것)', () => {
  it('제목 바로 아래(빈 줄 없이) 이어지는 본문을 잃지 않는다', () => {
    render(<Markdown text={'## 신청 방법\n1. 정부24 접속\n2. 공동인증서 로그인'} />)
    expect(screen.getByRole('heading', { name: '신청 방법' })).toBeInTheDocument()
    expect(screen.getByText('정부24 접속')).toBeInTheDocument()
    expect(screen.getByText('공동인증서 로그인')).toBeInTheDocument()
  })

  it('제목 뒤 본문이 목록이면 목록으로 렌더한다', () => {
    const { container } = render(<Markdown text={'# 대상\n- 만 19세 이상\n- 서울 거주'} />)
    expect(screen.getByRole('heading', { name: '대상' })).toBeInTheDocument()
    expect(container.querySelectorAll('ul li')).toHaveLength(2)
  })

  it('제목 뒤 본문이 단락이면 단락으로 렌더한다', () => {
    render(<Markdown text={'## 유의사항\n예산 소진 시 조기 마감됩니다.'} />)
    expect(screen.getByText('예산 소진 시 조기 마감됩니다.')).toBeInTheDocument()
  })

  it('빈 줄로 구분된 기존 문서도 그대로 동작한다', () => {
    const { container } = render(<Markdown text={'# 제목\n\n첫 단락\n\n- a\n- b'} />)
    expect(screen.getByRole('heading', { name: '제목' })).toBeInTheDocument()
    expect(screen.getByText('첫 단락')).toBeInTheDocument()
    expect(container.querySelectorAll('ul li')).toHaveLength(2)
  })
})

describe('Markdown — 기존 블록', () => {
  it('제목·목록·문단', () => {
    render(<Markdown text={'# 큰제목\n## 작은제목\n\n- 가\n- 나\n\n1. 하나\n2. 둘\n\n그냥 문단'} />)
    expect(screen.getByRole('heading', { level: 2, name: '큰제목' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: '작은제목' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByText('그냥 문단')).toBeInTheDocument()
  })

  it('제목 바로 아래 붙여 쓴 본문이 사라지지 않는다', () => {
    render(<Markdown text={'## 제목\n본문이 붙어 있다'} />)
    expect(screen.getByText('본문이 붙어 있다')).toBeInTheDocument()
  })
})

describe('Markdown — 링크', () => {
  it('내부 경로는 Link로, 새 창으로 열지 않는다', () => {
    render(<Markdown text="[내 지원금 보기](/my?age=20s&situations=no_house)" />)
    const a = screen.getByRole('link', { name: '내 지원금 보기' })
    expect(a).toHaveAttribute('href', '/my?age=20s&situations=no_house')
    expect(a).not.toHaveAttribute('target')
  })

  it('외부 링크는 새 창 + rel 보호', () => {
    render(<Markdown text="[복지로](https://www.bokjiro.go.kr)" />)
    const a = screen.getByRole('link', { name: '복지로' })
    expect(a).toHaveAttribute('target', '_blank')
    expect(a).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('위험한 스킴은 링크로 만들지 않고 글자만 남긴다', () => {
    // 초안 생성이 자동화되므로 검수자의 눈을 지나칠 수 있다. 문법 단계에서 막는다.
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', '//evil.com']) {
      const { unmount } = render(<Markdown text={`[누르지마](${bad})`} />)
      expect(screen.queryByRole('link')).toBeNull()
      expect(screen.getByText(/누르지마/)).toBeInTheDocument()
      unmount()
    }
  })

  it('목록 안의 링크도 동작한다', () => {
    render(<Markdown text={'- [가이드](/guide/x) 항목\n- 그냥 항목'} />)
    expect(screen.getByRole('link', { name: '가이드' })).toHaveAttribute('href', '/guide/x')
  })
})

describe('Markdown — 굵게', () => {
  it('**굵게**를 strong으로', () => {
    render(<Markdown text="이건 **중요한** 부분" />)
    expect(screen.getByText('중요한').tagName).toBe('STRONG')
  })

  it('짝이 안 맞는 별표는 그대로 둔다', () => {
    render(<Markdown text="가격은 **200만원" />)
    expect(screen.getByText(/\*\*200만원/)).toBeInTheDocument()
  })
})

describe('Markdown — 표', () => {
  const table = '| 구분 | 금액 |\n| --- | --- |\n| 첫째 | 200만원 |\n| 둘째 이상 | 300만원 |'

  it('헤더와 본문 행을 만든다', () => {
    render(<Markdown text={table} />)
    expect(screen.getByRole('columnheader', { name: '구분' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '300만원' })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(3) // 헤더 1 + 본문 2
  })

  it('셀 안에서도 링크·굵게가 동작한다', () => {
    render(<Markdown text={'| 제도 | 신청 |\n| --- | --- |\n| **부모급여** | [복지로](https://www.bokjiro.go.kr) |'} />)
    expect(screen.getByText('부모급여').tagName).toBe('STRONG')
    expect(screen.getByRole('link', { name: '복지로' })).toBeInTheDocument()
  })

  it('구분선이 없으면 표로 보지 않는다', () => {
    render(<Markdown text={'| 이건 | 표가 아니다 |'} />)
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('Markdown — 인용', () => {
  it('> 로 시작하는 블록을 blockquote로 만든다', () => {
    const { container } = render(<Markdown text={'> 18~34세만 참여 가능'} />)
    const bq = container.querySelector('blockquote')
    expect(bq).not.toBeNull()
    expect(bq!.textContent).toBe('18~34세만 참여 가능')
  })

  it('여러 줄 인용을 한 덩어리로 합친다', () => {
    const { container } = render(<Markdown text={'> 첫 줄\n> 둘째 줄'} />)
    expect(container.querySelectorAll('blockquote')).toHaveLength(1)
    expect(container.querySelector('blockquote')!.textContent).toBe('첫 줄 둘째 줄')
  })

  it('인용 안에서도 링크·굵게가 동작한다', () => {
    render(<Markdown text={'> **21점** 이상 [안내](https://www.gov.kr)'} />)
    expect(screen.getByText('21점').tagName).toBe('STRONG')
    expect(screen.getByRole('link', { name: '안내' })).toBeInTheDocument()
  })

  // 한 줄이라도 >가 아니면 인용이 아니다. 표의 셀 안에서 쓰인 부등호나
  // 본문 중간의 화살표(→ 대신 >)가 통째로 인용으로 빨려 들어가는 것을 막는다.
  it('일부 줄만 >면 인용으로 보지 않는다', () => {
    const { container } = render(<Markdown text={'> 인용\n평범한 줄'} />)
    expect(container.querySelector('blockquote')).toBeNull()
  })

  it('목록보다 먼저 판정하지 않아 - 목록은 그대로 목록이다', () => {
    const { container } = render(<Markdown text={'- 하나\n- 둘'} />)
    expect(container.querySelector('blockquote')).toBeNull()
    expect(container.querySelectorAll('li')).toHaveLength(2)
  })

  describe('그림', () => {
    const SVG = '/guide/youth-challenge-350.svg'

    it('한 줄 그림 문법을 figure/img로 만든다', () => {
      const { container } = render(<Markdown text={`![350만원의 구성](${SVG})`} />)
      const img = container.querySelector('figure img')
      expect(img).not.toBeNull()
      expect(img!.getAttribute('src')).toBe(SVG)
      expect(img!.getAttribute('alt')).toBe('350만원의 구성')
      expect(container.querySelector('figcaption')).toBeNull()
    })

    it('따옴표 캡션은 figcaption이 되고 alt와 따로 남는다', () => {
      const { container } = render(
        <Markdown text={`![막대 넷으로 나눈 350만원](${SVG} "참여수당과 인센티브의 구성")`} />,
      )
      expect(container.querySelector('img')!.getAttribute('alt')).toBe('막대 넷으로 나눈 350만원')
      expect(container.querySelector('figcaption')!.textContent).toBe('참여수당과 인센티브의 구성')
    })

    it('캡션 안에서도 링크가 동작한다', () => {
      render(<Markdown text={`![그림](${SVG} "출처 [보조금24](https://www.gov.kr)")`} />)
      expect(screen.getByRole('link', { name: '보조금24' })).toBeInTheDocument()
    })

    // 파일이 도착하기 전에도 자리를 잡아야 본문이 밀리지 않는다. 브라우저는 내려받기 전에는
    // viewBox를 볼 수 없으므로 비율을 우리가 먼저 알려 준다.
    it('내려받기 전에도 자리를 잡도록 비율을 붙인다', () => {
      const { container } = render(<Markdown text={`![그림](${SVG})`} />)
      expect(container.querySelector('img')!.getAttribute('style')).toContain('aspect-ratio: 480 / 180')
    })

    // 실린 그림 목록에 없는 주소는 전부 막는다. 오타 난 파일명이 통과하면 화면에는
    // 깨진 이미지만 남는데, 검수자는 렌더된 화면이 아니라 마크다운을 본다.
    it.each([
      ['/guide/youth-challenge-35.svg', '오타 난 파일명'],
      ['https://example.com/a.svg', '외부 주소'],
      ['/guide/../secret.svg', '상위 경로'],
      ['/uploads/a.svg', '허용 밖 폴더'],
      ['javascript:alert(1)', '스킴'],
    ])('%s는 그림으로 만들지 않는다 (%s)', (src) => {
      const { container } = render(<Markdown text={`![그림](${src})`} />)
      expect(container.querySelector('img')).toBeNull()
    })

    // 막힌 그림은 지우지 않고 문법 그대로 보여야 글쓴이가 오타를 알아본다.
    it('막힌 그림은 링크로 둔갑하지 않고 원문이 남는다', () => {
      const { container } = render(<Markdown text={'![그림](https://example.com/a.svg)'} />)
      expect(container.querySelector('a')).toBeNull()
      expect(container.textContent).toContain('![그림](https://example.com/a.svg)')
    })

    // 빈 alt는 문법에서 이미 걸리지만, 공백만 든 alt는 문법을 통과해 렌더 쪽 확인까지 온다.
    it.each([
      ['', '빈 alt'],
      [' ', '공백만 든 alt'],
    ])('alt가 %s이면 그림으로 만들지 않는다 (%s)', (alt) => {
      const { container } = render(<Markdown text={`![${alt}](${SVG})`} />)
      expect(container.querySelector('img')).toBeNull()
    })

    // 그림 앞뒤 문장이 같은 덩어리에 딸려 오면 문단이 통째로 사라진다.
    it('문단 안에 섞인 그림 문법은 그림이 아니라 글자로 남는다', () => {
      const { container } = render(<Markdown text={`앞 문장\n![그림](${SVG})`} />)
      expect(container.querySelector('img')).toBeNull()
      expect(container.textContent).toContain('앞 문장')
      expect(container.textContent).toContain(`![그림](${SVG})`)
    })

    it('그림은 앞뒤 빈 줄로 떼어 놓으면 본문과 함께 살아 있다', () => {
      const { container } = render(<Markdown text={`앞 문장\n\n![그림](${SVG})\n\n뒤 문장`} />)
      expect(container.querySelectorAll('figure')).toHaveLength(1)
      expect(container.querySelectorAll('p')).toHaveLength(2)
    })

    // 제목 바로 아래에 빈 줄 없이 붙여 쓰는 것은 흔한 작성 방식이다. 제목 정규화가
    // 이것도 떼어 주는지 고정해 둔다.
    it('제목 바로 아래에 붙여 써도 그림이 된다', () => {
      const { container } = render(<Markdown text={`## 소제목\n![그림](${SVG})`} />)
      expect(container.querySelector('h3')!.textContent).toBe('소제목')
      expect(container.querySelectorAll('figure')).toHaveLength(1)
    })

    // 인용·목록이 그림 분기에 먼저 걸려 사라지면 안 된다.
    it('인용 안의 그림 문법은 인용으로 남는다', () => {
      const { container } = render(<Markdown text={`> ![그림](${SVG})`} />)
      expect(container.querySelector('blockquote')).not.toBeNull()
      expect(container.querySelector('figure')).toBeNull()
    })

    // ! 뒤의 대괄호를 링크로 보지 않기로 한 대가. 의도된 동작이라 여기 고정해 둔다.
    it('느낌표 바로 뒤의 링크 문법은 링크가 되지 않는다', () => {
      const { container } = render(<Markdown text={'지금 확인하세요![내 지원금](/my)'} />)
      expect(container.querySelector('a')).toBeNull()
      expect(container.textContent).toContain('![내 지원금](/my)')
    })

    it('느낌표와 링크 사이에 공백이 있으면 링크가 된다', () => {
      render(<Markdown text={'지금 확인하세요! [내 지원금](/my)'} />)
      expect(screen.getByRole('link', { name: '내 지원금' })).toBeInTheDocument()
    })
  })
})
