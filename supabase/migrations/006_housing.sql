-- 청약홈(한국부동산원)·LH 분양임대 공고. 설계: docs/superpowers/specs/2026-11-10-housing-notices-design.md
--
-- 지원금(benefits)과 테이블을 나눈다. 공고는 접수 일정 6종·주택형별 가격·공고 상태를 가져
-- benefits에 넣으면 열 절반이 비고 검색·진단에 분기가 생긴다. 지역 코드(region_code)는
-- benefits와 같은 체계(data/regions.ts의 slug, 전국은 'ALL')를 쓰되, 매핑 실패는 'UNKNOWN'으로
-- 둔다 — 'ALL'로 두면 모든 지역 필터에 섞인다.
create table housing_notices (
  id uuid primary key default uuid_generate_v4(),
  source text not null check (source in ('applyhome','lh')),
  source_id text not null,
  slug text unique not null,
  title text not null,
  kind text not null check (kind in ('apt','apt_remainder','officetel_etc','lh_sale','lh_rent','lh_welfare','newlywed_town')),
  kind_detail text,
  region_code text not null default 'UNKNOWN',
  address text,
  supplier text,
  total_units int,
  notice_date date,
  special_start date,
  special_end date,
  rank1_start date,
  rank1_end date,
  rank2_start date,
  rank2_end date,
  winner_date date,
  contract_start date,
  contract_end date,
  move_in_ym text,
  -- 접수 전체 구간. 일정 6종 중 가장 이른 시작과 가장 늦은 종료. 목록 정렬·D-day·상태 계산이 이것만 본다.
  receipt_start date,
  receipt_end date,
  -- 주택형별 특별공급 세대수 합계. 목록 카드의 배지 근거(주택형 테이블을 조인하지 않기 위해 비정규화).
  sp_newlywed_units int not null default 0,
  sp_first_life_units int not null default 0,
  sp_multi_child_units int not null default 0,
  status text not null default 'open' check (status in ('upcoming','open','closed','removed')),
  detail_url text,
  raw jsonb not null default '{}'::jsonb,
  content_hash text not null,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source, source_id)
);

-- 목록 쿼리(status in (...) + order by receipt_end nulls last, slug)와 지역 집계(status로 거른 region_code)가 쓰는 인덱스.
-- status 단독·kind 단독 인덱스는 카디널리티가 낮아 쓰이지 않는다.
create index housing_notices_list_idx on housing_notices (status, receipt_end, slug);
create index housing_notices_region_idx on housing_notices (region_code);

-- 청약홈 APT·무순위 공고의 주택형별 행. LH는 없다.
create table housing_unit_types (
  notice_id uuid not null references housing_notices(id) on delete cascade,
  house_type text not null,
  supply_area numeric(7,2),
  max_price_manwon int,
  general_units int,
  special_units int,
  sp_newlywed int,
  sp_first_life int,
  sp_multi_child int,
  sp_old_parents int,
  sp_institution int,
  sp_etc int,
  primary key (notice_id, house_type)
);

alter table housing_notices enable row level security;
alter table housing_unit_types enable row level security;
create policy "public read housing_notices" on housing_notices for select using (true);
create policy "public read housing_unit_types" on housing_unit_types for select using (true);

comment on column housing_notices.region_code is 'data/regions.ts의 slug. 전국 ALL, 매핑 실패 UNKNOWN';
comment on column housing_notices.content_hash is '원문 항목의 안정 해시. 원천에 수정 시각이 없어 이것으로 변경을 감지한다';
