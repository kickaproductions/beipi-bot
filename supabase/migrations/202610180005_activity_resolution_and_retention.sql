alter table public.discord_server_activity
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null;

create or replace function public.manage_server_activity(
  target_guild_id text,
  target_log_id uuid,
  operation text
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  changed public.discord_server_activity;
  removed_count integer;
begin
  if not public.is_developer() then raise exception 'Developer access is required.'; end if;
  if operation='clear_resolved' then
    delete from public.discord_server_activity where guild_id=target_guild_id and resolved_at is not null;
    get diagnostics removed_count=row_count;
    return to_jsonb(removed_count);
  end if;
  if target_log_id is null or operation not in ('resolve','reopen') then raise exception 'Invalid activity operation.'; end if;
  update public.discord_server_activity set
    resolved_at=case when operation='resolve' then now() else null end,
    resolved_by=case when operation='resolve' then auth.uid() else null end
  where id=target_log_id and guild_id=target_guild_id
  returning * into changed;
  if changed.id is null then raise exception 'Activity entry not found.'; end if;
  return to_jsonb(changed);
end;
$$;
revoke all on function public.manage_server_activity(text,uuid,text) from public;
grant execute on function public.manage_server_activity(text,uuid,text) to authenticated;

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
      'title',recent.title,'detail',recent.detail,'metadata',recent.metadata,'createdAt',recent.created_at,
      'resolvedAt',recent.resolved_at
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
