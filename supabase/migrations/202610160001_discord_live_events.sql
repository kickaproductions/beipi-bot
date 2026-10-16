create table if not exists public.discord_live_events (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  member_id text not null,
  channel_id text,
  message_id text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(guild_id,member_id)
);

alter table public.discord_live_events enable row level security;
-- This operational table is intentionally service-role only. Dashboard users cannot read or modify it directly.
