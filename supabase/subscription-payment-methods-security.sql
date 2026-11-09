-- Secure subscription payment destination settings.
-- Apply after monetization.sql and subscription-security-phase1.sql.
-- Payment destinations are centrally stored; only users listed in admin_access can change them.

begin;

create table if not exists public.subscription_payment_methods (
  id text primary key,
  display_name text not null check (length(btrim(display_name)) between 2 and 80),
  dial_code text,
  merchant_code text,
  phone_number text,
  bank_name text,
  account_name text,
  account_number text,
  branch text,
  instructions text not null default '',
  display_order integer not null default 100,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint subscription_payment_method_has_destination check (
    not enabled
    or (merchant_code is not null and length(btrim(merchant_code)) > 0)
    or (phone_number is not null and length(btrim(phone_number)) > 0)
    or (account_number is not null and length(btrim(account_number)) > 0)
  )
);

alter table public.subscription_payment_methods enable row level security;

drop policy if exists "Public view enabled subscription payment methods" on public.subscription_payment_methods;
create policy "Public view enabled subscription payment methods"
on public.subscription_payment_methods
for select to anon, authenticated
using (
  enabled = true
  or exists (
    select 1 from public.admin_access aa
    where aa.user_id = (select auth.uid())
  )
);

drop policy if exists "Admins insert subscription payment methods" on public.subscription_payment_methods;
create policy "Admins insert subscription payment methods"
on public.subscription_payment_methods
for insert to authenticated
with check (
  exists (
    select 1 from public.admin_access aa
    where aa.user_id = (select auth.uid())
  )
  and updated_by = (select auth.uid())
);

drop policy if exists "Admins update subscription payment methods" on public.subscription_payment_methods;
create policy "Admins update subscription payment methods"
on public.subscription_payment_methods
for update to authenticated
using (
  exists (
    select 1 from public.admin_access aa
    where aa.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.admin_access aa
    where aa.user_id = (select auth.uid())
  )
  and updated_by = (select auth.uid())
);

revoke all on public.subscription_payment_methods from anon, authenticated, public;
grant select on public.subscription_payment_methods to anon, authenticated;
grant insert, update on public.subscription_payment_methods to authenticated;

-- Start with all channels disabled. Real receiving details must be entered by an administrator.
insert into public.subscription_payment_methods
  (id, display_name, dial_code, instructions, display_order, enabled)
values
  ('airtel_money', 'Airtel Money', '*211#', 'Use the official Airtel Money merchant payment menu.', 1, false),
  ('tnm_mpamba', 'TNM Mpamba', '*444#', 'Use the official TNM Mpamba merchant payment menu.', 2, false),
  ('national_bank', 'National Bank of Malawi', null, 'Use a bank transfer to the verified business account.', 3, false),
  ('standard_bank', 'Standard Bank Malawi', null, 'Use a bank transfer to the verified business account.', 4, false),
  ('google_play', 'Google Play', null, 'Available only through an officially configured Android app purchase flow.', 5, false)
on conflict (id) do nothing;

alter table public.subscriptions
  add column if not exists payment_method_id text
  references public.subscription_payment_methods(id);

-- Recreate the pending-request policy so a customer can only select a currently
-- enabled payment destination. This does not grant paid access.
drop policy if exists "Users submit own pending subscription requests" on public.subscriptions;
create policy "Users submit own pending subscription requests"
on public.subscriptions
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and plan_id <> 'free'
  and status = 'pending'
  and provider_reference is not null
  and length(btrim(provider_reference)) between 3 and 120
  and billing_period in ('monthly','yearly')
  and amount_mwk is not null
  and amount_mwk > 0
  and started_at is null
  and expires_at is null
  and auto_renewing = false
  and payment_method_id is not null
  and exists (
    select 1
    from public.subscription_payment_methods pm
    where pm.id = payment_method_id
      and pm.enabled = true
  )
);

commit;
