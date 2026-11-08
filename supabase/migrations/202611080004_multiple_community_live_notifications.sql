alter table public.discord_live_settings
  drop constraint if exists discord_live_settings_user_id_guild_id_key;

alter table public.discord_live_settings
  drop constraint if exists discord_live_settings_check;

alter table public.discord_live_settings
  alter column creator_role_id drop not null,
  alter column creator_role_name drop not null,
  alter column live_role_id drop not null,
  alter column live_role_name drop not null;

alter table public.discord_live_settings
  drop constraint if exists discord_live_settings_distinct_roles_check;

alter table public.discord_live_settings
  add constraint discord_live_settings_distinct_roles_check
  check (creator_role_id is null or live_role_id is null or creator_role_id<>live_role_id);

alter table public.discord_live_events
  add column if not exists source_key text not null default 'legacy';

alter table public.discord_live_events
  drop constraint if exists discord_live_events_guild_id_member_id_key;

alter table public.discord_live_events
  drop constraint if exists discord_live_events_guild_id_member_id_source_key_key;

alter table public.discord_live_events
  add constraint discord_live_events_guild_id_member_id_source_key_key
  unique(guild_id,member_id,source_key);

update public.stream_confirmation_settings
set message_template=replace(message_template,'# Stream in 1 hour!','# Stream in {lead_time}!')
where message_template like '# Stream in 1 hour!%';

create or replace function public.get_admin_servers()
returns table(
  guild_id text,
  guild_name text,
  bot_active boolean,
  member_count integer,
  installed_at timestamptz,
  last_seen_at timestamptz,
  setup_complete boolean,
  live_enabled boolean,
  owner_name text,
  owner_email text
)
language sql
stable
security definer
set search_path=public
as $$
  select registry.guild_id,registry.guild_name,registry.bot_active,registry.member_count,
    registry.installed_at,registry.last_seen_at,(settings.settings_count>0),
    coalesce(settings.live_enabled,false),
    coalesce(profile.display_name,split_part(profile.email,'@',1),''),coalesce(profile.email,'')
  from public.discord_guild_registry registry
  left join lateral (
    select count(*)::integer as settings_count,
      bool_or(rule.discord_presence_enabled) as live_enabled,
      min(rule.user_id::text)::uuid as user_id
    from public.discord_live_settings rule
    where rule.guild_id=registry.guild_id
  ) settings on true
  left join public.platform_connections connection
    on connection.platform='discord' and connection.external_user_id=registry.owner_discord_id
  left join public.profiles profile on profile.id=coalesce(settings.user_id,connection.user_id)
  where public.is_developer()
  order by registry.bot_active desc,registry.last_seen_at desc;
$$;
revoke all on function public.get_admin_servers() from public;
grant execute on function public.get_admin_servers() to authenticated;
