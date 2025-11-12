create extension if not exists "pgcrypto";

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  input_key text,
  isin text,
  ticker text,
  exchange_hint text,
  input_rank int,
  status text,
  status_msg text,
  created_at timestamptz default now()
);

create table if not exists raw_cache (
  id uuid primary key default gen_random_uuid(),
  ticker text unique,
  fetched_at timestamptz default now(),
  payload jsonb
);

create table if not exists metrics (
  id uuid primary key default gen_random_uuid(),
  ticker text,
  asof_date date,
  price numeric,
  pe numeric,
  ev_ebitda numeric,
  dcf_value_per_share numeric,
  dcf_vs_price_pct numeric,
  roic numeric,
  ebit_margin numeric,
  roe numeric,
  rev_cagr_3y numeric,
  eps_cagr_3y numeric,
  fcf_cagr_3y numeric,
  d_to_e numeric,
  interest_coverage numeric,
  insider_net_buys numeric,
  institutional_pct numeric,
  fund_flows_3m_m numeric,
  short_interest_pct numeric,
  beta numeric,
  fcf_to_netincome numeric,
  altman_z numeric,
  momentum_tag text,
  exp_ret_6m_base numeric,
  exp_ret_6m_bull numeric,
  exp_ret_6m_bear numeric,
  composite_score numeric,
  subscore_valuation numeric,
  subscore_profitability numeric,
  subscore_growth numeric,
  subscore_health numeric,
  subscore_sentiment numeric,
  subscore_earn_quality numeric
);

create table if not exists job_logs (
  id uuid primary key default gen_random_uuid(),
  job_id text,
  ticker text,
  stage text,
  message text,
  level text,
  ts timestamptz default now()
);

create index if not exists idx_metrics_ticker_asof on metrics (ticker, asof_date);
create index if not exists idx_raw_cache_ticker on raw_cache (ticker);
