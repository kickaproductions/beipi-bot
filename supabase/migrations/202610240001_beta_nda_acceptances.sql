create table if not exists public.beta_nda_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_email text,
  signer_name text not null check (char_length(trim(signer_name)) between 2 and 120),
  agreement_version text not null,
  accepted_at timestamptz not null default now(),
  unique (user_id, agreement_version)
);

alter table public.beta_nda_acceptances enable row level security;

drop policy if exists "Users can view their NDA acceptances" on public.beta_nda_acceptances;
create policy "Users can view their NDA acceptances"
on public.beta_nda_acceptances for select
using (
  auth.uid() = user_id
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'developer')
);

drop policy if exists "Approved testers can accept the NDA" on public.beta_nda_acceptances;
create policy "Approved testers can accept the NDA"
on public.beta_nda_acceptances for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and (founding_tester = true or role = 'developer')
  )
);

create index if not exists beta_nda_acceptances_user_id_idx on public.beta_nda_acceptances(user_id);
