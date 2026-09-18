-- 가이드 증보 시각.
--
-- guides에 날짜 컬럼이 published_at 하나뿐이라, 본문을 크게 보완해도 Article JSON-LD의
-- dateModified가 최초 발행일에 묶여 있었다. 실제로 출산 가이드를 3,324자에서 14,052자로
-- 늘렸는데 구글에는 "발행 후 변경 없음"으로 보였다. 발행일을 앞당겨 해결하면 최초 발행일이
-- 거짓이 되므로 컬럼을 나눈다.
--
-- nullable이다. 한 번도 손대지 않은 가이드는 null이고, 읽는 쪽에서 published_at으로 떨어진다.
-- 기존 행을 published_at으로 채우지 않는 이유가 여기 있다 — 채우면 "증보한 적 없음"과
-- "발행 당일 증보함"을 구분할 수 없다.
alter table guides add column updated_at timestamptz;

comment on column guides.updated_at is '본문을 실질적으로 보완한 시각. 오타 수정 같은 것에는 쓰지 않는다. null이면 발행 후 손대지 않은 것.';
