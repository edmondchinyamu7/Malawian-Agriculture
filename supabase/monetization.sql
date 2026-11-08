-- Malawian Agriculture monetisation foundation
-- Apply to the connected Supabase project. RLS is enabled on every public table.

begin;

create table if not exists public.admin_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_access enable row level security;
drop policy if exists "Users can read their own admin access marker" on public.admin_access;
create policy "Users can read their own admin access marker" on public.admin_access
  for select to authenticated using (user_id=(select auth.uid()));
insert into public.admin_access(user_id)
select id from public.profiles where role='admin'
on conflict(user_id) do nothing;

create table if not exists public.subscription_plans (
  id text primary key, name text not null,
  monthly_price_mwk integer not null check(monthly_price_mwk>=0),
  display_order integer not null unique, description text not null default '',
  features jsonb not null default '[]'::jsonb,
  ads_enabled boolean not null default true, active boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.subscription_plans(id,name,monthly_price_mwk,display_order,description,features,ads_enabled) values
('free','Free Farmer',0,1,'Essential agricultural knowledge at no cost.','["Basic farming guides","Crop library","Basic farming calendar","Agricultural news"]'::jsonb,true),
('standard','Standard Farmer',2000,2,'More practical guides and saved resources with an ad-supported experience.','["Everything in Free","Advanced farming guides","Saved farming resources","Detailed crop calendars","Advertisements may appear"]'::jsonb,true),
('professional','Professional Farmer',5000,3,'Advanced tools and premium learning resources.','["Everything in Standard","Advanced farm planning tools","Fertiliser calculations","Premium learning resources","Downloadable guides","Ad-free experience"]'::jsonb,false),
('agribusiness','Agribusiness Premium',10000,4,'Business-focused agricultural resources.','["Everything in Professional","Agricultural business resources","Market intelligence resources","Business planning materials","Priority platform support","Premium business tools as released"]'::jsonb,false)
on conflict(id) do update set name=excluded.name,monthly_price_mwk=excluded.monthly_price_mwk,
display_order=excluded.display_order,description=excluded.description,features=excluded.features,
ads_enabled=excluded.ads_enabled,active=true,updated_at=now();

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  status text not null default 'pending' check(status in ('pending','active','cancelled','expired','past_due','refunded')),
  provider text not null default 'manual' check(provider in ('manual','google_play','web','other')),
  provider_reference text, started_at timestamptz, expires_at timestamptz,
  auto_renewing boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_status_idx on public.subscriptions(user_id,status);
create index if not exists subscriptions_expiry_idx on public.subscriptions(expires_at);
create index if not exists subscriptions_plan_id_idx on public.subscriptions(plan_id);

create table if not exists public.revenue_entries (
  id uuid primary key default gen_random_uuid(),
  source text not null check(source in ('subscription','advertising','partnership','other')),
  amount_mwk numeric(14,2) not null check(amount_mwk>0),
  reference text, notes text, received_at timestamptz not null default now(),
  created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create index if not exists revenue_entries_received_at_idx on public.revenue_entries(received_at);
create index if not exists revenue_entries_created_by_idx on public.revenue_entries(created_by);

create table if not exists public.expense_entries (
  id uuid primary key default gen_random_uuid(), category text not null,
  amount_mwk numeric(14,2) not null check(amount_mwk>0),
  description text not null, spent_at date not null default current_date,
  created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create index if not exists expense_entries_spent_at_idx on public.expense_entries(spent_at);
create index if not exists expense_entries_created_by_idx on public.expense_entries(created_by);

create table if not exists public.app_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null default current_date, event_name text not null default 'app_open',
  created_at timestamptz not null default now(), unique(user_id,activity_date)
);
create index if not exists app_activity_date_idx on public.app_activity_events(activity_date);

create table if not exists public.business_partners (
  id uuid primary key default gen_random_uuid(), business_name text not null,
  contact_email text, status text not null default 'prospect' check(status in ('prospect','active','paused','ended')),
  monthly_value_mwk numeric(14,2) not null default 0 check(monthly_value_mwk>=0),
  notes text, created_at timestamptz not null default now()
);

alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.revenue_entries enable row level security;
alter table public.expense_entries enable row level security;
alter table public.app_activity_events enable row level security;
alter table public.business_partners enable row level security;

drop policy if exists "Users and admins view allowed profiles" on public.profiles;
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Users and admins view allowed profiles" on public.profiles
for select to authenticated using(id=(select auth.uid()) or exists(select 1 from public.admin_access aa where aa.user_id=(select auth.uid())));

drop policy if exists "Public and admins view subscription plans" on public.subscription_plans;
drop policy if exists "Anyone can view active subscription plans" on public.subscription_plans;
drop policy if exists "Admins manage subscription plans" on public.subscription_plans;
create policy "Public and admins view subscription plans" on public.subscription_plans
for select to anon,authenticated using(active=true or exists(select 1 from public.admin_access aa where aa.user_id=(select auth.uid())));
drop policy if exists "Admins insert subscription plans" on public.subscription_plans;
create policy "Admins insert subscription plans" on public.subscription_plans for insert to authenticated
with check(exists(select 1 from public.admin_access aa where aa.user_id=(select auth.uid())));
drop policy if exists "Admins update subscription plans" on public.subscription_plans;
create policy "Admins update subscription plans" on public.subscription_plans for update to authenticated
using(exists(select 1 from public.admin_access aa where aa.user_id=(select auth.uid())))
with check(exists(select 1 from public.admin_access aa where aa.user_id=(select auth.uid())));
drop policy if exists "Admins delete subscription plans" on public.subscription_plans;
create policy "Admins delete subscription plans" on public.subscription_plans for delete to authenticated
using(exists(select 1 from public.admin_access aa where aa.user_id=(select auth.uid())));

drop policy if exists "Users and admins view allowed subscriptions" on public.subscriptions;
drop policy if exists "Users view their own subscriptions" on public.subscriptions;
drop policy if exists "Admins view all subscriptions" on public.subscriptions;
create policy "Users and admins view allowed subscriptions" on public.subscriptions for select to authenticated
using(user_id=(select auth.uid()) or exists(select 1 from public.admin_access aa where aa.user_id=(select auth.uid())));

drop policy if exists "Admins manage revenue entries" on public.revenue_entries;
create policy "Admins manage revenue entries" on public.revenue_entries for all to authenticated
using(exists(select 1 from public.admin_access aa where aa.user_id=(select auth.uid())))
with check(exists(select 1 from public.admin_access aa where aa.user_id=(select auth.uid())));
drop policy if exists "Admins manage expense entries" on public.expense_entries;
create policy "Admins manage expense entries" on public.expense_entries for all to authenticated
using(exists(select 1 from public.admin_access aa where aa.user_id=(select auth.uid())))
with check(exists(select 1 from public.admin_access aa where aa.user_id=(select auth.uid())));

drop policy if exists "Users record their own daily activity" on public.app_activity_events;
create policy "Users record their own daily activity" on public.app_activity_events for insert to authenticated
with check(user_id=(select auth.uid()));
drop policy if exists "Users and admins view allowed activity" on public.app_activity_events;
drop policy if exists "Users view their own activity" on public.app_activity_events;
drop policy if exists "Admins view all activity" on public.app_activity_events;
create policy "Users and admins view allowed activity" on public.app_activity_events for select to authenticated
using(user_id=(select auth.uid()) or exists(select 1 from public.admin_access aa where aa.user_id=(select auth.uid())));

drop policy if exists "Admins manage business partners" on public.business_partners;
create policy "Admins manage business partners" on public.business_partners for all to authenticated
using(exists(select 1 from public.admin_access aa where aa.user_id=(select auth.uid())))
with check(exists(select 1 from public.admin_access aa where aa.user_id=(select auth.uid())));

grant select on public.subscription_plans to anon,authenticated;
grant select on public.subscriptions,public.app_activity_events to authenticated;
grant select,insert,update,delete on public.subscription_plans,public.revenue_entries,public.expense_entries,public.business_partners to authenticated;
grant select,insert on public.app_activity_events to authenticated;
commit;
