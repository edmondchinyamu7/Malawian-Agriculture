-- Subscription security phase 1
-- Apply after supabase/monetization.sql.
-- Paid access is granted only from administrator/provider-verified active rows.

begin;

alter table public.subscriptions
  add column if not exists billing_period text,
  add column if not exists amount_mwk integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'subscriptions_billing_period_check'
      and conrelid = 'public.subscriptions'::regclass
  ) then
    alter table public.subscriptions
      add constraint subscriptions_billing_period_check
      check (billing_period is null or billing_period in ('monthly','yearly'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'subscriptions_amount_mwk_check'
      and conrelid = 'public.subscriptions'::regclass
  ) then
    alter table public.subscriptions
      add constraint subscriptions_amount_mwk_check
      check (amount_mwk is null or amount_mwk > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'subscriptions_active_requires_started_at'
      and conrelid = 'public.subscriptions'::regclass
  ) then
    alter table public.subscriptions
      add constraint subscriptions_active_requires_started_at
      check (status <> 'active' or started_at is not null);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'subscriptions_expiry_after_start'
      and conrelid = 'public.subscriptions'::regclass
  ) then
    alter table public.subscriptions
      add constraint subscriptions_expiry_after_start
      check (expires_at is null or (started_at is not null and expires_at > started_at));
  end if;
end
$$;

-- Customers may submit only a pending request for their own account.
-- They cannot set activation dates, status, or auto-renewal.
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
);

-- Only an administrator listed in admin_access can approve, activate,
-- expire, refund, or otherwise update a subscription row.
drop policy if exists "Admins update subscription records" on public.subscriptions;
create policy "Admins update subscription records"
on public.subscriptions
for update
to authenticated
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
);

grant select, insert, update on public.subscriptions to authenticated;
revoke insert, update, delete on public.subscriptions from anon, public;

commit;
