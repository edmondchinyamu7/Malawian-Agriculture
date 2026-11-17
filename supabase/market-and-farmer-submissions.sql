-- Ulimi wa Malawi | Market Intelligence & Farmer Price Submissions RLS
-- Run in the connected Supabase project SQL Editor.

begin;

-- Ensure market_price_reports has required columns for farmer attribution & moderation
alter table if exists public.market_price_reports
  add column if not exists reporter_user_id uuid references auth.users(id) on delete set null,
  add column if not exists source_type text not null default 'verified_source',
  add column if not exists verified_by uuid references auth.users(id) on delete set null,
  add column if not exists verified_at timestamptz;

alter table if exists public.market_price_reports enable row level security;

-- Public & authenticated users can read ONLY verified reports, their own submitted reports, or all rows if admin
drop policy if exists "Public can read verified market price reports" on public.market_price_reports;
drop policy if exists "Anyone can view verified market reports" on public.market_price_reports;
create policy "Public can read verified market price reports" on public.market_price_reports
for select to anon, authenticated
using (
  status = 'verified'
  or reporter_user_id = (select auth.uid())
  or exists (select 1 from public.admin_access aa where aa.user_id = (select auth.uid()))
);

-- Authenticated farmers can submit pending observations for admin review
drop policy if exists "Farmers can submit pending market price reports" on public.market_price_reports;
create policy "Farmers can submit pending market price reports" on public.market_price_reports
for insert to authenticated
with check (
  reporter_user_id = (select auth.uid())
  and status = 'pending'
  and source_type = 'farmer'
  and verified_by is null
  and verified_at is null
  and price_min > 0
  and price_max >= price_min
);

-- Admins retain full write/moderation rights
drop policy if exists "Admins manage market price reports" on public.market_price_reports;
create policy "Admins manage market price reports" on public.market_price_reports
for all to authenticated
using (exists (select 1 from public.admin_access aa where aa.user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_access aa where aa.user_id = (select auth.uid())));

-- Admins can approve or reject pending subscriptions from the Admin Dashboard
drop policy if exists "Admins update subscriptions" on public.subscriptions;
create policy "Admins update subscriptions" on public.subscriptions
for update to authenticated
using (exists (select 1 from public.admin_access aa where aa.user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_access aa where aa.user_id = (select auth.uid())));

grant select on public.market_price_reports to anon, authenticated;
grant insert on public.market_price_reports to authenticated;
grant update, delete on public.market_price_reports to authenticated;
grant update on public.subscriptions to authenticated;

commit;
