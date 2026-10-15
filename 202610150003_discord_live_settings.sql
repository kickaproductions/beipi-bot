create table if not exists public.discord_live_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  guild_id text not null,
  guild_name text not null,
  creator_role_id text not null,
  creator_role_name text not null,
  live_role_id text not null,
  live_role_name text not null,
  alert_channel_id text not null,
  alert_channel_name text not null,
  discord_presence_enabled boolean not null default true,
  platform_confirmation_enabled boolean not null default true,
  delete_expired_alert boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,guild_id),
  check(creator_role_id<>live_role_id)
);

alter table public.discord_live_settings enable row level security;
create policy "People can read their own Discord live settings" on public.discord_live_settings for select using(auth.uid()=user_id);
create policy "People can add their own Discord live settings" on public.discord_live_settings for insert with check(auth.uid()=user_id);
create policy "People can update their own Discord live settings" on public.discord_live_settings for update using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "People can delete their own Discord live settings" on public.discord_live_settings for delete using(auth.uid()=user_id);
