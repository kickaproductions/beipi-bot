create table if not exists public.stream_confirmation_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  guild_id text,
  guild_name text,
  channel_id text,
  channel_name text,
  lead_minutes integer not null default 60 check (lead_minutes between 15 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not enabled or (guild_id is not null and channel_id is not null))
);

create table if not exists public.stream_confirmation_runs (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null unique references public.companion_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  discord_user_id text not null,
  status text not null default 'claiming' check (status in ('claiming','pending','confirmed','cancelled')),
  dm_message_id text,
  announcement_message_id text,
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companion_items_stream_due_idx
  on public.companion_items(due)
  where kind='crew-stream' and done=false;

create index if not exists stream_confirmation_runs_user_idx
  on public.stream_confirmation_runs(user_id,created_at desc);

alter table public.stream_confirmation_settings enable row level security;
alter table public.stream_confirmation_runs enable row level security;

drop policy if exists "People can read their own stream confirmation settings" on public.stream_confirmation_settings;
create policy "People can read their own stream confirmation settings"
  on public.stream_confirmation_settings for select using(auth.uid()=user_id);
drop policy if exists "People can create their own stream confirmation settings" on public.stream_confirmation_settings;
create policy "People can create their own stream confirmation settings"
  on public.stream_confirmation_settings for insert with check(auth.uid()=user_id);
drop policy if exists "People can update their own stream confirmation settings" on public.stream_confirmation_settings;
create policy "People can update their own stream confirmation settings"
  on public.stream_confirmation_settings for update using(auth.uid()=user_id) with check(auth.uid()=user_id);

drop policy if exists "People can read their own stream confirmations" on public.stream_confirmation_runs;
create policy "People can read their own stream confirmations"
  on public.stream_confirmation_runs for select using(auth.uid()=user_id);
