alter table public.profiles
  add column if not exists account_status text not null default 'active' check(account_status in ('active','suspended')),
  add column if not exists suspension_reason text,
  add column if not exists suspended_at timestamptz;

create table if not exists public.account_admin_audit (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  reason text,
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists account_admin_audit_target_created_idx on public.account_admin_audit(target_user_id,created_at desc);
alter table public.account_admin_audit enable row level security;
drop policy if exists "Developers can read account audit" on public.account_admin_audit;
create policy "Developers can read account audit" on public.account_admin_audit for select using(public.is_developer());

create table if not exists public.discord_guild_registry (
  guild_id text primary key,
  guild_name text not null,
  owner_discord_id text not null,
  member_count integer not null default 0,
  bot_active boolean not null default true,
  installed_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  removed_at timestamptz
);
create index if not exists discord_guild_registry_owner_idx on public.discord_guild_registry(owner_discord_id);
alter table public.discord_guild_registry enable row level security;
drop policy if exists "Developers can read Discord guild registry" on public.discord_guild_registry;
create policy "Developers can read Discord guild registry" on public.discord_guild_registry for select using(public.is_developer());

drop function if exists public.manage_account_access(uuid,text,boolean,boolean);
create or replace function public.manage_account_access(
  target_id uuid,
  new_role text,
  new_founding_tester boolean,
  new_lifetime_free boolean,
  new_account_status text,
  moderation_reason text default null
) returns public.profiles
language plpgsql
security definer
set search_path=public
as $$
declare
  caller_role text;
  previous_profile public.profiles;
  updated_profile public.profiles;
  action_name text;
begin
  select role into caller_role from public.profiles where id=auth.uid();
  if caller_role is distinct from 'developer' then raise exception 'Developer access is required.'; end if;
  if new_role not in ('user','developer') then raise exception 'Invalid account role.'; end if;
  if new_account_status not in ('active','suspended') then raise exception 'Invalid account status.'; end if;
  select * into previous_profile from public.profiles where id=target_id;
  if previous_profile.id is null then raise exception 'Account not found.'; end if;
  if target_id=auth.uid() and (new_role<>'developer' or new_account_status='suspended') then
    raise exception 'You cannot demote or suspend your own developer account.';
  end if;
  if new_account_status='suspended' and coalesce(trim(moderation_reason),'')='' then
    raise exception 'A suspension reason is required.';
  end if;
  update public.profiles set
    role=new_role,
    founding_tester=new_founding_tester,
    lifetime_free=new_lifetime_free,
    account_status=new_account_status,
    suspension_reason=case when new_account_status='suspended' then trim(moderation_reason) else null end,
    suspended_at=case when new_account_status='suspended' and previous_profile.account_status<>'suspended' then now() when new_account_status='suspended' then previous_profile.suspended_at else null end,
    updated_at=now()
  where id=target_id returning * into updated_profile;
  action_name=case
    when previous_profile.account_status<>updated_profile.account_status and updated_profile.account_status='suspended' then 'account_suspended'
    when previous_profile.account_status<>updated_profile.account_status then 'account_unsuspended'
    when previous_profile.founding_tester and not updated_profile.founding_tester then 'tester_access_revoked'
    else 'account_access_updated'
  end;
  insert into public.account_admin_audit(target_user_id,actor_user_id,action,reason,previous_values,new_values)
  values(target_id,auth.uid(),action_name,nullif(trim(moderation_reason),''),
    jsonb_build_object('role',previous_profile.role,'foundingTester',previous_profile.founding_tester,'lifetimeFree',previous_profile.lifetime_free,'status',previous_profile.account_status),
    jsonb_build_object('role',updated_profile.role,'foundingTester',updated_profile.founding_tester,'lifetimeFree',updated_profile.lifetime_free,'status',updated_profile.account_status));
  return updated_profile;
end;
$$;
revoke all on function public.manage_account_access(uuid,text,boolean,boolean,text,text) from public;
grant execute on function public.manage_account_access(uuid,text,boolean,boolean,text,text) to authenticated;

create or replace function public.get_admin_account_servers()
returns table(user_id uuid,guild_id text,guild_name text,bot_active boolean,member_count integer,last_seen_at timestamptz,setup_complete boolean,live_enabled boolean)
language sql
stable
security definer
set search_path=public
as $$
  select distinct coalesce(settings.user_id,connection.user_id) as user_id,
    registry.guild_id,registry.guild_name,registry.bot_active,registry.member_count,registry.last_seen_at,
    (settings.id is not null) as setup_complete,coalesce(settings.discord_presence_enabled,false) as live_enabled
  from public.discord_guild_registry registry
  left join public.discord_live_settings settings on settings.guild_id=registry.guild_id
  left join public.platform_connections connection on connection.platform='discord' and connection.external_user_id=registry.owner_discord_id
  where public.is_developer() and coalesce(settings.user_id,connection.user_id) is not null;
$$;
revoke all on function public.get_admin_account_servers() from public;
grant execute on function public.get_admin_account_servers() to authenticated;
