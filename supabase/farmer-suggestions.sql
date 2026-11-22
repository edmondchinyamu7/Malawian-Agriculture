-- Ulimi wa Malawi | Farmer suggestions
-- Farmers can submit suggestions and read only their own submissions.
-- Administrators can read all suggestions and post a response/update status.

begin;

create table if not exists public.farmer_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('website','market_prices','crops_and_farming','farmer_support','other')),
  subject text not null check (char_length(trim(subject)) between 4 and 120),
  message text not null check (char_length(trim(message)) between 10 and 3000),
  status text not null default 'new' check (status in ('new','reviewing','responded','closed')),
  admin_response text check (admin_response is null or char_length(admin_response) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists farmer_suggestions_user_created_idx
  on public.farmer_suggestions (user_id, created_at desc);
create index if not exists farmer_suggestions_status_created_idx
  on public.farmer_suggestions (status, created_at desc);

alter table public.farmer_suggestions enable row level security;

revoke all on table public.farmer_suggestions from anon, authenticated;
grant select, insert, update on table public.farmer_suggestions to authenticated;
grant all on table public.farmer_suggestions to service_role;

drop policy if exists "Farmers read their own suggestions" on public.farmer_suggestions;
create policy "Farmers read their own suggestions"
  on public.farmer_suggestions for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Farmers submit their own suggestions" on public.farmer_suggestions;
create policy "Farmers submit their own suggestions"
  on public.farmer_suggestions for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'new'
    and admin_response is null
  );

drop policy if exists "Admins read all farmer suggestions" on public.farmer_suggestions;
create policy "Admins read all farmer suggestions"
  on public.farmer_suggestions for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_access aa
      where aa.user_id = (select auth.uid())
    )
  );

drop policy if exists "Admins update farmer suggestions" on public.farmer_suggestions;
create policy "Admins update farmer suggestions"
  on public.farmer_suggestions for update
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

create or replace function public.set_farmer_suggestions_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_farmer_suggestions_updated_at on public.farmer_suggestions;
create trigger set_farmer_suggestions_updated_at
before update on public.farmer_suggestions
for each row execute function public.set_farmer_suggestions_updated_at();

commit;
