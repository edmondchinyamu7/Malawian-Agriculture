-- Ulimi wa Malawi: server-side subscription price protection (Phase 1)
-- Apply after monetization.sql and subscription-security-phase1.sql.
-- Existing plan names, benefits, payment methods and billing periods are unchanged.

begin;

-- Store both billing prices in the trusted database catalogue.
alter table public.subscription_plans
  add column if not exists yearly_price_mwk integer;

-- Set only the existing four plans' official prices. Do not rewrite names,
-- descriptions, feature lists, display order, or access rules.
update public.subscription_plans
set monthly_price_mwk = case id
      when 'free' then 0
      when 'standard' then 2000
      when 'professional' then 5000
      when 'agribusiness' then 10000
    end,
    yearly_price_mwk = case id
      when 'free' then 0
      when 'standard' then 20000
      when 'professional' then 50000
      when 'agribusiness' then 100000
    end
where id in ('free', 'standard', 'professional', 'agribusiness');

do $$
declare
  v_plan_count integer;
begin
  select count(*) into v_plan_count
  from public.subscription_plans
  where id in ('free', 'standard', 'professional', 'agribusiness');

  if v_plan_count <> 4 then
    raise exception
      'Subscription price protection requires all four existing plans. Found % of 4; no partial setup is allowed.',
      v_plan_count;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'subscription_plans_yearly_price_mwk_check'
      and conrelid = 'public.subscription_plans'::regclass
  ) then
    alter table public.subscription_plans
      add constraint subscription_plans_yearly_price_mwk_check
      check (yearly_price_mwk is not null and yearly_price_mwk >= 0);
  end if;
end
$$;

alter table public.subscription_plans
  alter column yearly_price_mwk set not null;

-- A caller supplies only the selected plan, billing period and payment
-- reference. The amount is selected from the database, never trusted from JS.
create or replace function public.submit_subscription_request(
  p_plan_id text,
  p_billing_period text,
  p_provider_reference text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_amount_mwk integer;
  v_subscription_id uuid;
  v_reference text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication is required to submit a subscription request.'
      using errcode = '42501';
  end if;

  if p_plan_id is null or p_plan_id not in ('standard', 'professional', 'agribusiness') then
    raise exception 'The selected paid plan is not valid.'
      using errcode = '22023';
  end if;

  if p_billing_period is null or p_billing_period not in ('monthly', 'yearly') then
    raise exception 'Billing period must be monthly or yearly.'
      using errcode = '22023';
  end if;

  v_reference := btrim(coalesce(p_provider_reference, ''));
  if length(v_reference) < 3 or length(v_reference) > 120 then
    raise exception 'Payment reference must contain between 3 and 120 characters.'
      using errcode = '22023';
  end if;

  select case
      when p_billing_period = 'monthly' then sp.monthly_price_mwk
      else sp.yearly_price_mwk
    end
    into v_amount_mwk
  from public.subscription_plans sp
  where sp.id = p_plan_id
    and sp.active = true;

  if not found or v_amount_mwk is null or v_amount_mwk <= 0 then
    raise exception 'The selected subscription plan is unavailable.'
      using errcode = '22023';
  end if;

  insert into public.subscriptions (
    user_id,
    plan_id,
    status,
    provider,
    provider_reference,
    billing_period,
    amount_mwk,
    started_at,
    expires_at,
    auto_renewing
  )
  values (
    v_user_id,
    p_plan_id,
    'pending',
    'manual',
    v_reference,
    p_billing_period,
    v_amount_mwk,
    null,
    null,
    false
  )
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$function$;

-- Remove the direct insert route so authenticated clients must use the
-- trusted function above. Existing admin review/update behaviour is retained.
revoke insert on table public.subscriptions from anon, authenticated, public;
grant execute on function public.submit_subscription_request(text, text, text)
  to authenticated;
revoke all on function public.submit_subscription_request(text, text, text)
  from public, anon;

commit;
