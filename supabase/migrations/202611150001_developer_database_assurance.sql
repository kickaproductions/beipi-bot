-- Protect direct database calls with the same assurance level as the developer portal.
create or replace function public.is_developer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt()->>'aal' = 'aal2', false)
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'developer' and account_status = 'active'
    );
$$;

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
set search_path = ''
as $$
declare
  previous_profile public.profiles;
  updated_profile public.profiles;
  action_name text;
begin
  if not public.is_developer() then
    raise exception 'Developer access with two-factor authentication is required.' using errcode = '42501';
  end if;
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

revoke execute on function public.manage_account_access(uuid,text,boolean,boolean,text,text) from public, anon;
grant execute on function public.manage_account_access(uuid,text,boolean,boolean,text,text) to authenticated;
revoke execute on function public.get_admin_account_servers() from public, anon;
revoke execute on function public.get_admin_servers() from public, anon;
revoke execute on function public.get_admin_server_detail(text) from public, anon;
revoke execute on function public.manage_server_activity(text,uuid,text) from public, anon;

alter policy "Users can view their NDA acceptances" on public.beta_nda_acceptances
  using (auth.uid() = user_id or (select public.is_developer()));

alter policy "Users read their beta request" on public.tester_access_requests
  using (auth.uid() = user_id or (select public.is_developer()));

alter policy "Testers can read their feedback" on public.tester_feedback
  using (auth.uid() = user_id or (select public.is_developer()));

alter policy "Developers can update feedback" on public.tester_feedback
  using ((select public.is_developer()))
  with check ((select public.is_developer()));

alter policy "Testers and developers read feedback screenshots" on storage.objects
  using (bucket_id = 'tester-feedback' and (
    (storage.foldername(name))[1] = auth.uid()::text or (select public.is_developer())
  ));
