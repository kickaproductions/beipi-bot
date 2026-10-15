create table if not exists public.platform_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('twitch','discord','google','kick')),
  external_user_id text not null,
  display_name text not null,
  username text,
  avatar_url text,
  metadata jsonb not null default '{}'::jsonb,
  encrypted_session text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);

create index if not exists platform_connections_user_id_idx on public.platform_connections(user_id);

alter table public.platform_connections enable row level security;

create policy "People can read their own platform connections"
  on public.platform_connections for select using (auth.uid()=user_id);
create policy "People can add their own platform connections"
  on public.platform_connections for insert with check (auth.uid()=user_id);
create policy "People can update their own platform connections"
  on public.platform_connections for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "People can delete their own platform connections"
  on public.platform_connections for delete using (auth.uid()=user_id);
