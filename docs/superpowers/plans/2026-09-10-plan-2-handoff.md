# Plan 2 인수인계 — 남은 Task 10~14

> 작성: 2026-09-10. Task 1~9까지 구현·리뷰·수정 완료. **이 문서만 읽고 Task 10부터 바로 시작할 수 있게** 쓴 문서다.
> 원본 플랜: `docs/superpowers/plans/2026-09-10-plan-2-screens.md` (3,274줄, Task 1~9는 헤딩에 ✅ 표시)
> 스펙: `docs/superpowers/specs/2026-09-10-benefits-portal-design.md` (12절에 미결정 사항)

---

## 1. 재개 절차

```bash
cd /Users/mw/prodect/benefits
source ~/.nvm/nvm.sh && nvm use 22      # 필수. 시스템 기본 Node 18은 vitest 4를 깨뜨린다
git checkout feat/plan-2-screens        # head = b4ccff7
npx vitest run && npx tsc --noEmit && npx eslint . && npm run build
```

기대값은 아래 표와 같다. 다르면 먼저 원인을 찾고 시작한다.

| 게이트 | 기대값 |
|---|---|
| vitest | 27개 파일 / 140개 테스트 통과 |
| tsc --noEmit | 오류 0 |
| eslint . | 오류 0 |
| npm run build | 성공, 정적 페이지 66개 |

로컬 확인은 `npm run dev -- -p 3111`. 이미 3111을 쓰는 프로세스가 있으면 `pkill -f "next dev"`.

`tsc`가 `.next/types/...` 에서 모듈을 못 찾는다고 하면 `rm -rf .next` 후 재실행한다. 실제 코드 오류가 아니라 오래된 빌드 산출물이다.

---

## 2. 남은 Task 5개

원본 플랜에 완전한 코드가 들어 있다. 여기에는 **플랜에 없는, 착수 전에 알아야 하는 사실만** 적는다.

### Task 10 — 지원금 상세 페이지 (A안) · 플랜 2194행

만들 파일: `src/lib/benefits/checklist.ts`, `src/components/benefits/{Checklist,SummaryGrid,StickyRail,SourceFooter,Markdown}.tsx`, `src/app/(site)/benefit/[slug]/page.tsx`
테스트: `src/lib/benefits/__tests__/checklist.test.ts`, `src/components/benefits/__tests__/Checklist.test.tsx`

착수 전 알아야 할 것:

- **`benefit_articles` 테이블은 0행이다.** 따라서 모든 상세 페이지가 `benefit_articles === null` 경로로 렌더된다. 해설·신청 순서·FAQ·체크리스트가 전부 비어 있는 상태가 정상이며, 이 경로에서 화면이 깨지지 않는지가 이 태스크의 핵심 검증 항목이다. 콘텐츠 생성·검수는 Plan 3이다.
- 그 결과 `benefitIndexable()`이 전 건에 대해 false를 반환하므로 상세 페이지는 전부 `noindex`다. 의도된 동작이다(검수된 콘텐츠만 색인).
- `benefit_conditions`는 10,947행 전부 있다. 요약 카드의 나이·소득·가구 표시는 실데이터로 동작한다.
- Markdown 렌더러를 새로 만들 때 의존성을 추가하지 말 것. `globals.css`에 `.prose` 최소 스타일이 이미 있다(Task 5). Tailwind typography 플러그인은 설치돼 있지 않다.

### Task 11 — 마감 캘린더 + 가이드 페이지 · 플랜 2713행

만들 파일: `src/lib/benefits/calendar.ts`, `src/app/(site)/deadline/page.tsx`, `src/app/(site)/guide/[slug]/page.tsx`
수정: `src/lib/benefits/queries.ts` (`getGuide` 추가, `listDeadlineSoon` limit 확대)
테스트: `src/lib/benefits/__tests__/calendar.test.ts`

착수 전 알아야 할 것:

- **`guides` 테이블은 0행이다.** `/guide/[slug]`는 전부 404가 되는 것이 현재의 정상 상태다.
- `/deadline` 링크는 이미 헤더와 홈에 걸려 있다(Task 5, 7). 이 태스크가 끝나기 전까지 그 링크는 404다. 이 태스크가 그것을 해소한다.
- `listDeadlineSoon`의 시그니처는 플랜 원문과 다르다. 현재는 **`listDeadlineSoon(days: number, limit = 8)`** 이고 현재 시각을 인자로 받지 않는다. 이유는 4절에 있다. 플랜의 Task 11 코드 블록은 이미 `listDeadlineSoon(45, 200)`으로 수정해 두었다.
- 기간형 공고는 614건뿐이다. 45일 안에 마감하는 항목이 적을 수 있으니 빈 그룹 처리를 확인한다.

### Task 12 — 사이트맵 · robots · OG 이미지 · Cron 태그 · 플랜 2892행

만들 파일: `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/opengraph-image.tsx`, `src/lib/seo/sitemap-entries.ts`
수정: `src/app/api/cron/sync-gov24/route.ts`와 그 테스트
테스트: `src/lib/seo/__tests__/sitemap-entries.test.ts`

착수 전 알아야 할 것:

- **이 태스크는 Task 4의 캐시 태그를 실제로 동작시키는 태스크다.** 현재 `benefits:all` 태그를 무효화하는 코드가 없어서, 동기화가 돌아도 상세·목록·집계 캐시는 각자의 `revalidate` 시간(1~6시간)이 지나야 갱신된다. Task 12가 그 한 줄을 넣는다. 프로덕션 정합성이 이 태스크에 걸려 있다.
- 같은 자리의 `revalidateTag('benefit:'+slug)`와 `revalidateTag('segment:'+seg)` 루프를 **지운다.** `unstable_cache` 태그는 함수 단위라 그 태그를 가진 캐시 항목이 존재하지 않는다. 아무것도 무효화하지 못하면서, 원본 갱신 시각이 통째로 바뀌는 동기화(실제로 10,947건 전부 변경으로 잡힌 적 있음)에서는 만 번 넘는 호출이 되어 Vercel Hobby의 60초 실행 제한을 위협한다. 플랜 본문에 이 지시를 적어 두었다.
- 사이트맵은 지금 거의 빈 상태가 정상이다. 색인 대상이 되는 상세 페이지가 0건이고(`benefit_articles` 0행), 지역 페이지도 `description_md`가 전부 null이라 `regionHubIndexable`이 false다. 분야 허브 3개와 필수 페이지만 들어간다.

### Task 13 — 검색 정렬 개선 · 플랜 3098행

수정: `src/lib/benefits/search.ts`와 그 테스트

착수 전 알아야 할 것:

- 이건 Plan 1에서 넘어온 항목이다. 문제: 상황 조건이 아예 등록되지 않은(전 국민 대상) 항목이 상황 필터를 통과해 상단을 차지한다. 실제 예로 "20대·구직" 검색에 인플루엔자 예방접종이 올라온다.
- `search.ts`에는 이미 `group()` 함수로 조건 없는 항목을 뒤로 보내는 1차 정렬이 있다. Task 13은 여기에 `matchScore`(상황 2점·지역 1점·나이 1점)를 얹는다.
- `/my` 화면은 이미 `hasConditions === false` 항목을 "조건 확인 필요" 별도 섹션으로 분리한다(Task 8). Task 13의 정렬은 그 위 그룹 내부 순서를 개선하는 것이다.
- 참고로 `SearchResultItem`에는 `agency`·`apply_start`·`synced_at`이 없어서 `/my`의 카드에는 기관명이 안 나온다. 홈·허브 카드에는 나온다. 이 태스크에서 `search.ts`의 select에 `agency`를 넣으면 화면이 통일된다. 선택 사항이다.

### Task 14 — 전체 검증 · 성능 · 문서 · 플랜 3192행

수정: `README.md`, 스펙 12절

착수 전 알아야 할 것:

- Lighthouse 모바일 90점 이상, CLS 0.1 미만이 목표다. 이 환경에는 headless 브라우저가 설치돼 있지 않다. Task 9 담당 에이전트도 400px 확인을 렌더된 HTML과 컴파일된 CSS로만 했다. 실측이 필요하면 브라우저 설치가 선행돼야 한다.
- 스펙 12절에 이미 Plan 2 실행 중 발견 사항이 기록돼 있다. Task 14는 여기에 최종 상태를 덧붙인다.
- 병합은 `git checkout main && git merge --ff-only feat/plan-2-screens`.

---

## 3. 사람이 해야 하는 일 (코드로 해결 불가)

### 3-1. Supabase 마이그레이션 002 — 아직 미적용

Supabase 대시보드 SQL 편집기에서 실행한다.

```sql
create policy "public read sync_runs" on sync_runs for select using (true);
```

확인 방법: 서비스 롤로는 `sync_runs` 6행이 보이는데 anon 키로는 0행이 보인다. 적용 후 anon으로도 보이면 성공이다. 그때까지 홈 하단의 "최종 동기화" 값이 계속 "확인 중"으로 나온다.

환경변수에 DB 접속 문자열이 없고 `psql`도 설치돼 있지 않아 코드로는 DDL을 실행할 수 없다.

### 3-2. 광주 지역 taxonomy — 결정 필요

실데이터의 소관기관명이 `전남광주통합특별시`로 들어와 `extractRegion`이 광주를 전부 `jeonnam`으로 분류한다. 결과는 전남 1,053건, 광주 1건이다.

임시 처리는 이미 넣어 두었다. 건수 0인 지역 칩은 렌더하지 않고, 색인은 기존 `regionHubIndexable`(3건 이상 + 지역 안내문 존재)에 맡긴다. 그래서 광주 페이지는 링크는 되지만 noindex다.

최종 선택지는 세 가지다. 스펙 12절에도 적혀 있다.

1. `gwangju` 슬러그를 없애고 `jeonnam`의 표시명을 통합 명칭으로 바꾼다. URL 1개 감소.
2. 두 슬러그를 유지하고 `gwangju` → `jeonnam` 리다이렉트를 넣는다.
3. 현재의 건수 기반 필터를 그대로 유지한다. 구조 변경 없음.

### 3-3. 광고·분석 환경변수

`.env.local.example`에 자리는 만들어 두었다. 승인·발급 후 `.env.local`에 채운다.

`NEXT_PUBLIC_ADSENSE_CLIENT`, `NEXT_PUBLIC_ADSENSE_SLOT_{HOME,LIST,DETAIL_1,DETAIL_2,RAIL}`, `NEXT_PUBLIC_ADFIT_UNIT_{MOBILE,PC}`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_CONTACT_EMAIL`

`NEXT_PUBLIC_CONTACT_EMAIL`은 애드센스 심사에 필요한 연락 수단이므로 배포 전 반드시 채운다. 비어 있으면 문의 페이지가 링크 대신 안내 문구를 보여준다.

---

## 4. 플랜 원문과 달라진 부분 (남은 태스크에 영향)

플랜의 해당 코드 블록은 모두 아래 내용으로 이미 갱신해 두었다. 그래도 다시 읽는 사람이 헷갈리지 않게 이유를 남긴다.

| 대상 | 변경 | 이유 |
|---|---|---|
| `listDeadlineSoon`, `listRecentlyUpdated` | 현재 시각 인자 제거. `(days, limit)`, `(hours, limit)` | `unstable_cache`는 직렬화된 인자를 캐시 키에 넣는다. 요청마다 `new Date()`를 넘기면 키가 매번 달라져 적중률 0이 되고 `revalidate`와 태그가 무력화된다 |
| `countByRegion` | `.range()` 페이징 + `.order('id')` 안정 정렬 | Supabase는 한 응답에 1000행만 준다. 출산·육아 3,186건이라 페이징 없이는 집계가 조용히 축소되고 지역별로 편향됐다 |
| `getLastSyncAt` | `.not('finished_at','is',null)` 추가 | 진행 중인 동기화 행도 error·aborted_reason이 null이라 정렬 1위가 되어 "최종 동기화"가 빈다 |
| `BenefitListRow` 등 | `deadline_type`·`status`·`gender`·`review_status`를 `string`에서 유니온으로 | DB에 check 제약이 있다. 유니온이면 페이지의 분기에 exhaustiveness 검사가 걸린다. `ReviewStatus`를 `src/types/database.ts`에 추가했다 |
| `ads.txt` | 정적 `public/ads.txt` 삭제, `src/app/ads.txt/route.ts` 신설 | Google은 루트 ads.txt에 자기 퍼블리셔 ID가 없으면 광고를 게재하지 않는다. 주석만 있는 파일도 같은 취급이라 승인 후 노출이 0이 된다. 환경변수가 없으면 404를 준다 |
| `AdPlacement` | `process.env`의 템플릿 문자열 인덱싱을 슬롯별 정적 맵으로 | Next.js는 정적으로 분석 가능한 `NEXT_PUBLIC_*` 참조만 치환한다. 동적 인덱싱은 클라이언트 번들에서 조용히 undefined가 된다 |
| `AdPlacement` | 클라이언트 ID와 슬롯 ID가 **둘 다** 있을 때만 애드센스 렌더 | 하나만 있으면 높이만 예약된 빈 박스가 남아 CLS를 해친다 |
| 광고 프레임 | `div` → `aside` | `role` 없는 `div`의 `aria-label`은 무시된다 |
| 지역 허브 제목 | `rows.length` → `countByRegion` 기반 실제 건수 | `limit: 60`이 그대로 "60개"로 나가 사실과 다른 숫자를 보여줬다 |
| 분야·지역 허브 | 목록이 잘렸을 때 안내 문구 + 조건 진단 링크 추가 | 제목의 전체 건수와 카드 수가 다르면 누락으로 보인다. 동시에 진단 흐름으로 유도한다 |
| 페이지 전체 | 어떤 페이지도 `<main>`을 렌더하지 않는다 | `(site)/layout.tsx`가 이미 `<main>`을 낸다. 중첩되면 유효하지 않은 HTML |
| 플랜의 `git add -A` | 명시 경로 스테이징 + `git diff --cached --stat` 확인으로 교체 | 5절 참고 |

`benefits.region_code`는 이름과 달리 행정표준코드가 아니라 `data/regions.ts`의 **slug**(`seoul`, `gyeonggi`, `ALL`)를 담는다. `regions` 테이블의 `code`(`11`, `26`)와 다르다. 카드·칩에서 이름을 찾을 때 slug로 조회해야 한다.

---

## 5. 서브에이전트로 진행할 때의 함정 (실제로 겪은 것들)

Task 1~9를 subagent-driven-development로 진행하면서 실제로 발생한 문제들이다. 같은 방식으로 이어갈 경우 프롬프트에 미리 넣어야 한다.

**공유 워크트리 사고 2건.** 구현 에이전트와 내가 같은 디렉터리에서 동시에 작업했다.

- Task 5 에이전트의 `git add -A`가 내 미커밋 파일 4개를 자기 커밋에 넣었다. `reset --soft`로 되돌렸다.
- Task 6 에이전트가 베이스라인 측정을 위해 `git stash -u`를 실행해 내 in-flight 작업을 15초간 스태시했다. 다행히 pop이 성공했다.

프롬프트에 항상 넣을 세 줄:

1. `git add -A` / `git add .` 금지. 자기가 만든 경로만 스테이징한다.
2. 커밋 직전 `git diff --cached --stat`으로 남의 파일이 없는지 확인한다.
3. `git stash` 금지. 베이스라인은 `git show HEAD:<path>`나 임시 클론으로 측정한다.

**서브에이전트가 응답 없이 멈추는 두 가지 원인.**

- 신뢰되지 않은 폴더: `~/.claude.json`의 `projects[<경로>].hasTrustDialogAccepted`가 없으면 헤드리스 tmux 패널에서 신뢰 대화상자에 걸려 무한 대기한다. 진단은 `tmux -L claude-swarm-<부모PID> capture-pane -p -t %0`.
- 좀비 프로세스 누적: 작업을 마친 에이전트의 `claude --agent-id ...` 프로세스가 종료되지 않고 pty를 계속 점유한다. 9개가 쌓인 뒤 새 spawn이 `respawn pane failed: fork failed: Device not configured`로 실패했다. `ps -eo pid,command | grep -- '--agent-id'`로 찾아 `kill -9`한다. **보고를 받은 에이전트는 바로 정리하는 습관을 들이는 게 낫다.**

**보고 유실.** 에이전트가 작업을 끝냈는데 `Failed to write to socket`으로 보고가 전달되지 않은 적이 두 번 있다. 패널 스크롤백은 대체 화면 때문에 남지 않는다. 살아 있는 에이전트에게 `SendMessage`로 재전송을 요청하면 된다. 에이전트가 `to: "main"`으로 보내면 거부되므로 프롬프트에 **`team-lead`로 보내라고 명시**한다.

**테스트가 조용히 거짓 통과한 사례.** Task 7의 테스트 목이 `mockResolvedValue(new Response(...))`로 같은 `Response` 객체를 재사용했다. `Response` 본문은 한 번만 읽을 수 있어서 두 번째 호출부터 `r.json()`이 실패했는데, 구현이 모든 오류를 삼켜 테스트는 통과했다. 실제로는 칩을 두 개 이상 누르면 개수가 갱신되지 않는 상태였다. **fetch 목은 호출마다 새 `Response`를 만들고, `beforeEach`에 `mockReset()`을 넣는다.**

**리뷰는 반드시 별도로 돌린다.** Task 1~9에서 매 태스크마다 실제 버그가 나왔다. 가장 컸던 것은 `countByRegion`의 1000행 절단으로, 오류도 경고도 없이 그럴듯한 숫자를 보여주고 있었다.

---

## 6. 지금 동작하는 것 / 아직 비어 있는 것

동작하는 것:

- 홈(`/`) 조건 진단 패널. 나이 5 · 상황 7 · 지역 17 칩, localStorage 저장, 실시간 개수 조회
- `/my` 진단 결과. 50개씩 더 보기, "조건 확인 필요" 그룹 분리
- 분야 허브 `/youth` `/parenting` `/small-biz`, 분야×지역 51개 페이지
- 필수 페이지 `/about` `/privacy` `/terms` `/contact`, `/ads.txt` 라우트
- 검색 API `/api/benefits/search`, 동기화 Cron `/api/cron/sync-gov24`
- 지원금 10,947건, 조건 10,947건, 지역 17건이 실데이터로 적재됨

아직 비어 있는 것:

- 상세 페이지(Task 10), 마감 캘린더·가이드(Task 11), 사이트맵·robots·OG(Task 12)
- `benefit_articles` 0행, `guides` 0행, `regions.description_md` 전부 null → 상세·지역 페이지는 전부 noindex
- `/deadline` 링크가 헤더와 홈에 있으나 페이지가 없어 404 (Task 11이 해소)
- Upstash Redis 환경변수 미설정. `getOrSet`이 캐시 없이 통과하도록 되어 있어 기능은 정상, 속도만 느리다
