create table if not exists public.discord_owner_live_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  guild_id text not null,
  guild_name text not null,
  alert_channel_id text not null,
  alert_channel_name text not null,
  everyone_enabled boolean not null default true,
  role_id text,
  role_name text,
  message_template text not null,
  delete_expired_alert boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,guild_id)
);

insert into public.discord_owner_live_settings (
  user_id,guild_id,guild_name,alert_channel_id,alert_channel_name,
  everyone_enabled,role_id,role_name,message_template,delete_expired_alert
)
select
  user_id,guild_id,guild_name,owner_alert_channel_id,coalesce(owner_alert_channel_name,''),
  owner_everyone_enabled,owner_role_id,owner_role_name,
  coalesce(owner_message_template,E'# {streamer} is now live!\n{streamer} is streaming {game} on {platform}.\nCome and say hello\n{url}'),
  delete_expired_alert
from public.discord_live_settings
where owner_alert_channel_id is not null and owner_alert_channel_id<>''
on conflict(user_id,guild_id) do nothing;

alter table public.discord_owner_live_settings enable row level security;
drop policy if exists "People can read their own personal live settings" on public.discord_owner_live_settings;
drop policy if exists "People can add their own personal live settings" on public.discord_owner_live_settings;
drop policy if exists "People can update their own personal live settings" on public.discord_owner_live_settings;
drop policy if exists "People can delete their own personal live settings" on public.discord_owner_live_settings;
create policy "People can read their own personal live settings" on public.discord_owner_live_settings for select using(auth.uid()=user_id);
create policy "People can add their own personal live settings" on public.discord_owner_live_settings for insert with check(auth.uid()=user_id);
create policy "People can update their own personal live settings" on public.discord_owner_live_settings for update using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "People can delete their own personal live settings" on public.discord_owner_live_settings for delete using(auth.uid()=user_id);
