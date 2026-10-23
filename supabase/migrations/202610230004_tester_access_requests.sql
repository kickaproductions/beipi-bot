create table if not exists public.tester_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  message text,
  developer_response text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tester_access_requests_status_created_idx on public.tester_access_requests(status,created_at desc);
alter table public.tester_access_requests enable row level security;

create policy "Users read their beta request" on public.tester_access_requests for select using (
  auth.uid()=user_id or exists(select 1 from public.profiles where id=auth.uid() and role='developer')
);

create or replace function public.request_tester_access(request_message text default null)
returns setof public.tester_access_requests
language plpgsql security definer set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if exists(select 1 from public.profiles where id=auth.uid() and (founding_tester or role='developer')) then raise exception 'Tester access already enabled'; end if;
  return query
    insert into public.tester_access_requests(user_id,status,message,developer_response,reviewed_by,reviewed_at,created_at,updated_at)
    values(auth.uid(),'pending',nullif(trim(request_message),''),null,null,null,now(),now())
    on conflict(user_id) do update set status='pending',message=excluded.message,developer_response=null,reviewed_by=null,reviewed_at=null,created_at=now(),updated_at=now()
    returning *;
end;
$$;

create or replace function public.review_tester_access(request_id uuid,review_decision text,review_note text default null)
returns setof public.tester_access_requests
language plpgsql security definer set search_path=public
as $$
declare target_user uuid;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='developer') then raise exception 'Developer access required'; end if;
  if coalesce(auth.jwt()->>'aal','') <> 'aal2' then raise exception 'Two-factor authentication required'; end if;
  if review_decision not in ('approved','declined') then raise exception 'Invalid review decision'; end if;
  select user_id into target_user from public.tester_access_requests where id=request_id;
  if target_user is null then raise exception 'Request not found'; end if;
  if review_decision='approved' then update public.profiles set founding_tester=true,lifetime_free=true,updated_at=now() where id=target_user; end if;
  return query update public.tester_access_requests set status=review_decision,developer_response=nullif(trim(review_note),''),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=request_id returning *;
end;
$$;

revoke all on function public.request_tester_access(text) from public;
revoke all on function public.review_tester_access(uuid,text,text) from public;
grant execute on function public.request_tester_access(text) to authenticated;
grant execute on function public.review_tester_access(uuid,text,text) to authenticated;
