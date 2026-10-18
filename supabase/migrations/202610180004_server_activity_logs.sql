create table if not exists public.discord_server_activity (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.discord_guild_registry(guild_id) on delete cascade,
  event_type text not null,
  severity text not null default 'info' check(severity in ('info','warning','error')),
  title text not null,
  detail text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists discord_server_activity_guild_created_idx
  on public.discord_server_activity(guild_id,created_at desc);
alter table public.discord_server_activity enable row level security;
drop policy if exists "Developers can read Discord server activity" on public.discord_server_activity;
create policy "Developers can read Discord server activity"
  on public.discord_server_activity for select using(public.is_developer());

create or replace function public.get_admin_server_detail(target_guild_id text)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  with selected as (
    select registry.*,
      coalesce(settings.user_id,discord_connection.user_id) as linked_user_id,
      settings.id as settings_id,
      settings.guild_name as settings_guild_name,
      settings.creator_role_id,settings.creator_role_name,
      settings.live_role_id,settings.live_role_name,
      settings.alert_channel_id,settings.alert_channel_name,
      settings.owner_alert_channel_id,settings.owner_alert_channel_name,
      settings.owner_everyone_enabled,settings.discord_presence_enabled,
      settings.platform_confirmation_enabled,settings.delete_expired_alert,
      settings.updated_at as settings_updated_at
    from public.discord_guild_registry registry
    left join public.discord_live_settings settings on settings.guild_id=registry.guild_id
    left join public.platform_connections discord_connection
      on discord_connection.platform='discord' and discord_connection.external_user_id=registry.owner_discord_id
    where registry.guild_id=target_guild_id and public.is_developer()
    limit 1
  )
  select jsonb_build_object(
    'guildId',selected.guild_id,'guildName',selected.guild_name,'botActive',selected.bot_active,
    'memberCount',selected.member_count,'installedAt',selected.installed_at,'lastSeenAt',selected.last_seen_at,
    'removedAt',selected.removed_at,
    'owner',case when profile.id is null then null else jsonb_build_object(
      'id',profile.id,'name',coalesce(profile.display_name,split_part(profile.email,'@',1)),'email',profile.email
    ) end,
    'platforms',coalesce((select jsonb_agg(jsonb_build_object(
      'platform',connection.platform,'displayName',connection.display_name,
      'username',coalesce(connection.username,''),'connectedAt',connection.connected_at
    ) order by connection.platform) from public.platform_connections connection where connection.user_id=selected.linked_user_id),'[]'::jsonb),
    'activity',coalesce((select jsonb_agg(jsonb_build_object(
      'id',recent.id,'eventType',recent.event_type,'severity',recent.severity,
      'title',recent.title,'detail',recent.detail,'metadata',recent.metadata,'createdAt',recent.created_at
    ) order by recent.created_at desc) from (
      select * from public.discord_server_activity
      where guild_id=selected.guild_id order by created_at desc limit 50
    ) recent),'[]'::jsonb),
    'settings',case when selected.settings_id is null then null else jsonb_build_object(
      'guildName',selected.settings_guild_name,
      'creatorRoleId',selected.creator_role_id,'creatorRoleName',selected.creator_role_name,
      'liveRoleId',selected.live_role_id,'liveRoleName',selected.live_role_name,
      'alertChannelId',selected.alert_channel_id,'alertChannelName',selected.alert_channel_name,
      'ownerAlertChannelId',coalesce(selected.owner_alert_channel_id,''),
      'ownerAlertChannelName',coalesce(selected.owner_alert_channel_name,''),
      'ownerEveryoneEnabled',selected.owner_everyone_enabled,
      'discordPresenceEnabled',selected.discord_presence_enabled,
      'platformConfirmationEnabled',selected.platform_confirmation_enabled,
      'deleteExpiredAlert',selected.delete_expired_alert,
      'updatedAt',selected.settings_updated_at
    ) end
  )
  from selected
  left join public.profiles profile on profile.id=selected.linked_user_id;
$$;
revoke all on function public.get_admin_server_detail(text) from public;
grant execute on function public.get_admin_server_detail(text) to authenticated;
