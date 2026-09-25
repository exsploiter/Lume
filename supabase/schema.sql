-- DebtRadar Supabase schema
-- Run in Supabase SQL editor

create extension if not exists "uuid-ossp";

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  repo_url text not null,
  repo_owner text not null,
  repo_name text not null,
  status text not null default 'pending'
    check (status in ('pending','fetching','parsing','scoring','graphing','complete','failed')),
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  progress_message text,
  error_message text,
  total_files integer not null default 0,
  total_nodes integer not null default 0,
  avg_debt_score numeric(10,2) not null default 0,
  fingerprint_label text,
  fingerprint_confidence numeric(5,4),
  security_summary jsonb,
  security_collapse boolean not null default false,
  critical_vulnerabilities integer not null default 0,
  repo_security_score numeric(10,2) not null default 0,
  collapse_score numeric(10,2) not null default 0,
  collapse_prediction jsonb,
  attack_graph jsonb,
  repo_exploitability_score numeric(10,2) not null default 0,
  high_risk_attack_paths jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.debt_nodes (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  file_path text not null,
  symbol_name text not null,
  node_type text not null check (node_type in ('function','class','module','variable')),
  line_start integer not null,
  line_end integer not null,
  debt_score numeric(10,2) not null default 0,
  security_score numeric(10,2) not null default 0,
  security_weighted_score numeric(10,2) not null default 0,
  has_critical_security boolean not null default false,
  vulnerability_count integer not null default 0,
  security_risk_level text,
  exploitability_score numeric(10,2) not null default 0,
  collapse_risk numeric(10,2) not null default 0,
  autofix_available boolean not null default false,
  attack_surface_score numeric(10,2) not null default 0,
  propagation_risk numeric(10,2) not null default 0,
  public_exposure boolean not null default false,
  critical_attack_paths jsonb not null default '[]'::jsonb,
  fix_patch text,
  fix_confidence numeric(5,4) not null default 0,
  merge_risk text,
  complexity integer not null default 1,
  duplication_score numeric(5,4) not null default 0,
  blast_radius integer not null default 0,
  owasp_categories jsonb not null default '[]'::jsonb,
  cwe_categories jsonb not null default '[]'::jsonb,
  security_findings jsonb not null default '[]'::jsonb,
  dependencies jsonb not null default '[]'::jsonb,
  dependents jsonb not null default '[]'::jsonb,
  explanation text,
  fingerprint_tag text,
  x numeric(12,4),
  y numeric(12,4),
  created_at timestamptz not null default now()
);

create index if not exists idx_analyses_user on public.analyses(user_id);
create index if not exists idx_analyses_status on public.analyses(status);
create index if not exists idx_debt_nodes_analysis on public.debt_nodes(analysis_id);
create index if not exists idx_debt_nodes_score on public.debt_nodes(analysis_id, debt_score desc);
create index if not exists idx_debt_nodes_security on public.debt_nodes(analysis_id, security_score desc);

alter table public.analyses enable row level security;
alter table public.debt_nodes enable row level security;

create policy "Analyses are viewable by everyone"
  on public.analyses for select using (true);

create policy "Analyses insertable by authenticated users"
  on public.analyses for insert with check (auth.uid() = user_id or user_id is null);

create policy "Analyses updatable by service"
  on public.analyses for update using (true);

create policy "Debt nodes viewable by everyone"
  on public.debt_nodes for select using (true);

create policy "Debt nodes insertable"
  on public.debt_nodes for insert with check (true);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists analyses_updated_at on public.analyses;
create trigger analyses_updated_at
  before update on public.analyses
  for each row execute function public.handle_updated_at();
