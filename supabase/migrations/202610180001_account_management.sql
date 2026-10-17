create or replace function public.is_developer()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='developer');
$$;

revoke all on function public.is_developer() from public;
grant execute on function public.is_developer() to authenticated;

drop policy if exists "Developers can read profiles" on public.profiles;
create policy "Developers can read profiles" on public.profiles
for select using (public.is_developer());

create or replace function public.manage_account_access(
  target_id uuid,
  new_role text,
  new_founding_tester boolean,
  new_lifetime_free boolean
) returns public.profiles
language plpgsql
security definer
set search_path=public
as $$
declare
  caller_role text;
  updated_profile public.profiles;
begin
  select role into caller_role from public.profiles where id=auth.uid();
  if caller_role is distinct from 'developer' then
    raise exception 'Developer access is required.';
  end if;
  if new_role not in ('user','developer') then
    raise exception 'Invalid account role.';
  end if;
  if target_id=auth.uid() and new_role<>'developer' then
    raise exception 'You cannot remove your own developer access.';
  end if;
  update public.profiles set
    role=new_role,
    founding_tester=new_founding_tester,
    lifetime_free=new_lifetime_free,
    updated_at=now()
  where id=target_id
  returning * into updated_profile;
  if updated_profile.id is null then
    raise exception 'Account not found.';
  end if;
  return updated_profile;
end;
$$;

revoke all on function public.manage_account_access(uuid,text,boolean,boolean) from public;
grant execute on function public.manage_account_access(uuid,text,boolean,boolean) to authenticated;
