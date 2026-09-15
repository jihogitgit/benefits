-- 이름·기관·요약 검색용 트라이그램 인덱스.
-- 검색은 ILIKE '%단어%' 형태라 앞이 열려 있어 btree 인덱스를 전혀 타지 못한다.
-- open 상태만 1만여 건이라 인덱스 없이는 검색 한 번에 전건 순차 스캔이 돈다.
--
-- 한계를 알고 쓴다: pg_trgm은 패턴에서 완성된 트라이그램을 뽑을 수 있어야 인덱스를 태우므로
-- 부분 문자열이 3자 이상일 때만 효과가 있다. 2자 검색어는 전체 인덱스 스캔으로 떨어진다.
-- 운영 DB 실측(5회 평균, 네트워크 왕복 포함):
--   '월세'(2자) 524ms · '청년'(2자) 221ms · '장려금'(3자) 93ms · '근로장려금'(5자) 77ms
-- 3자 이상에서 3~7배 빨라지므로 인덱스는 유지한다. 2자 검색어는 Redis 캐시(검색어 요청 60초)가
-- 반복 호출을 흡수한다. 데이터가 수십만 건으로 늘면 그때는 형태소 기반 전문검색으로 가야 한다.
--
-- Supabase 관례상 확장은 extensions 스키마에 둔다(public에 두면 보안 어드바이저가 경고한다).
-- 이미 public에 만들어져 있으면 아래 문장은 아무 일도 하지 않는다 — 스키마를 옮기지는 않으므로,
-- 옮겨야 한다면 alter extension pg_trgm set schema extensions; 를 따로 실행한다.
create extension if not exists pg_trgm with schema extensions;

create index if not exists benefits_title_trgm on benefits using gin (title gin_trgm_ops);
create index if not exists benefits_agency_trgm on benefits using gin (agency gin_trgm_ops);
create index if not exists benefits_summary_trgm on benefits using gin (summary gin_trgm_ops);
