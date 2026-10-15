create table if not exists public.discord_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists discord_drafts_user_id_updated_idx on public.discord_drafts(user_id,updated_at desc);
alter table public.discord_drafts enable row level security;
create policy "People can read their own Discord drafts" on public.discord_drafts for select using (auth.uid()=user_id);
create policy "People can add their own Discord drafts" on public.discord_drafts for insert with check (auth.uid()=user_id);
create policy "People can update their own Discord drafts" on public.discord_drafts for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "People can delete their own Discord drafts" on public.discord_drafts for delete using (auth.uid()=user_id);
