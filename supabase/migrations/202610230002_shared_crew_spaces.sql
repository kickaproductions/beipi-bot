create table if not exists public.crew_invitations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  collaborator_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id,collaborator_user_id),
  check(owner_user_id<>collaborator_user_id)
);

create table if not exists public.crew_shared_items (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('task','note')),
  title text not null check (char_length(title) between 1 and 200),
  note text not null default '',
  due timestamptz,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crew_invitations_collaborator_idx on public.crew_invitations(collaborator_user_id,status);
create index if not exists crew_shared_items_owner_idx on public.crew_shared_items(owner_user_id,created_at desc);

alter table public.crew_invitations enable row level security;
alter table public.crew_shared_items enable row level security;

drop policy if exists "Crew members can read invitations" on public.crew_invitations;
create policy "Crew members can read invitations" on public.crew_invitations for select
  using (auth.uid()=owner_user_id or auth.uid()=collaborator_user_id);

drop policy if exists "Crew members can read shared items" on public.crew_shared_items;
create policy "Crew members can read shared items" on public.crew_shared_items for select
  using (
    auth.uid()=owner_user_id or exists(
      select 1 from public.crew_invitations invitation
      where invitation.owner_user_id=crew_shared_items.owner_user_id
        and invitation.collaborator_user_id=auth.uid()
        and invitation.status='accepted'
    )
  );

create or replace function public.invite_crew_moderator(target_twitch_username text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  caller_id uuid:=auth.uid();
  target_connection public.platform_connections;
  invitation public.crew_invitations;
begin
  if caller_id is null then raise exception 'Not signed in'; end if;
  select * into target_connection from public.platform_connections
  where platform='twitch' and lower(coalesce(username,display_name))=lower(trim(target_twitch_username))
  limit 1;
  if target_connection.user_id is null then
    return jsonb_build_object('ok',false,'error','That Twitch account has not connected to B.E.I.P.I. yet.');
  end if;
  if target_connection.user_id=caller_id then
    return jsonb_build_object('ok',false,'error','You cannot invite your own account.');
  end if;
  insert into public.crew_invitations(owner_user_id,collaborator_user_id,status,updated_at)
  values(caller_id,target_connection.user_id,'pending',now())
  on conflict(owner_user_id,collaborator_user_id) do update set status='pending',updated_at=now()
  returning * into invitation;
  return jsonb_build_object('ok',true,'invitationId',invitation.id,'displayName',target_connection.display_name,'username',target_connection.username);
end;
$$;

create or replace function public.crew_invitation_overview()
returns jsonb language sql security definer set search_path=public stable as $$
  select jsonb_build_object(
    'sent',coalesce((
      select jsonb_agg(jsonb_build_object('id',i.id,'status',i.status,'displayName',coalesce(c.display_name,p.display_name,'B.E.I.P.I. user'),'username',c.username,'avatarUrl',c.avatar_url,'updatedAt',i.updated_at) order by i.updated_at desc)
      from public.crew_invitations i
      left join public.platform_connections c on c.user_id=i.collaborator_user_id and c.platform='twitch'
      left join public.profiles p on p.id=i.collaborator_user_id
      where i.owner_user_id=auth.uid()
    ),'[]'::jsonb),
    'received',coalesce((
      select jsonb_agg(jsonb_build_object('id',i.id,'status',i.status,'displayName',coalesce(c.display_name,p.display_name,'B.E.I.P.I. streamer'),'username',c.username,'avatarUrl',c.avatar_url,'broadcasterId',c.external_user_id,'updatedAt',i.updated_at) order by i.updated_at desc)
      from public.crew_invitations i
      left join public.platform_connections c on c.user_id=i.owner_user_id and c.platform='twitch'
      left join public.profiles p on p.id=i.owner_user_id
      where i.collaborator_user_id=auth.uid()
    ),'[]'::jsonb)
  );
$$;

create or replace function public.update_crew_invitation(invitation_id uuid,requested_action text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if requested_action in ('accept','decline') then
    update public.crew_invitations set status=case when requested_action='accept' then 'accepted' else 'declined' end,updated_at=now()
    where id=invitation_id and collaborator_user_id=auth.uid() and status='pending';
  elsif requested_action='revoke' then
    update public.crew_invitations set status='revoked',updated_at=now()
    where id=invitation_id and owner_user_id=auth.uid();
  else
    return false;
  end if;
  return found;
end;
$$;

create or replace function public.get_shared_crew_space(target_broadcaster_id text)
returns jsonb language plpgsql security definer set search_path=public stable as $$
declare
  owner_connection public.platform_connections;
  invitation_status text;
  allowed boolean:=false;
begin
  select * into owner_connection from public.platform_connections
  where platform='twitch' and external_user_id=target_broadcaster_id limit 1;
  if owner_connection.user_id is null then return jsonb_build_object('registered',false,'allowed',false); end if;
  if owner_connection.user_id=auth.uid() then allowed:=true; invitation_status:='owner';
  else
    select status into invitation_status from public.crew_invitations
    where owner_user_id=owner_connection.user_id and collaborator_user_id=auth.uid() limit 1;
    allowed:=invitation_status='accepted';
  end if;
  return jsonb_build_object(
    'registered',true,
    'allowed',allowed,
    'status',coalesce(invitation_status,'none'),
    'streamer',jsonb_build_object('displayName',owner_connection.display_name,'username',owner_connection.username,'avatarUrl',owner_connection.avatar_url,'broadcasterId',owner_connection.external_user_id),
    'streams',case when allowed then coalesce((select jsonb_agg(jsonb_build_object('id',item.id,'title',item.title,'note',item.note,'due',item.due) order by item.due) from public.companion_items item where item.user_id=owner_connection.user_id and item.kind='crew-stream' and item.done=false and item.due>=now()),'[]'::jsonb) else '[]'::jsonb end,
    'items',case when allowed then coalesce((select jsonb_agg(jsonb_build_object('id',item.id,'kind',item.kind,'title',item.title,'note',item.note,'due',item.due,'done',item.done,'createdAt',item.created_at) order by item.done,item.due nulls last,item.created_at desc) from public.crew_shared_items item where item.owner_user_id=owner_connection.user_id),'[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

create or replace function public.save_shared_crew_item(target_broadcaster_id text,item_id uuid,item_kind text,item_title text,item_note text,item_due timestamptz,item_done boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  owner_id uuid;
  saved public.crew_shared_items;
begin
  select user_id into owner_id from public.platform_connections where platform='twitch' and external_user_id=target_broadcaster_id limit 1;
  if owner_id is null or not (owner_id=auth.uid() or exists(select 1 from public.crew_invitations where owner_user_id=owner_id and collaborator_user_id=auth.uid() and status='accepted')) then raise exception 'Shared space access required'; end if;
  if item_kind not in ('task','note') or length(trim(item_title))<1 then raise exception 'Invalid shared item'; end if;
  if item_id is null then
    insert into public.crew_shared_items(owner_user_id,created_by_user_id,kind,title,note,due,done)
    values(owner_id,auth.uid(),item_kind,left(trim(item_title),200),left(coalesce(item_note,''),2000),item_due,coalesce(item_done,false)) returning * into saved;
  else
    update public.crew_shared_items set title=left(trim(item_title),200),note=left(coalesce(item_note,''),2000),due=item_due,done=coalesce(item_done,false),updated_at=now()
    where id=item_id and owner_user_id=owner_id returning * into saved;
  end if;
  if saved.id is null then raise exception 'Shared item not found'; end if;
  return jsonb_build_object('id',saved.id,'kind',saved.kind,'title',saved.title,'note',saved.note,'due',saved.due,'done',saved.done,'createdAt',saved.created_at);
end;
$$;

create or replace function public.delete_shared_crew_item(target_broadcaster_id text,item_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare owner_id uuid;
begin
  select user_id into owner_id from public.platform_connections where platform='twitch' and external_user_id=target_broadcaster_id limit 1;
  if owner_id is null or not (owner_id=auth.uid() or exists(select 1 from public.crew_invitations where owner_user_id=owner_id and collaborator_user_id=auth.uid() and status='accepted')) then return false; end if;
  delete from public.crew_shared_items where id=item_id and owner_user_id=owner_id;
  return found;
end;
$$;

grant execute on function public.invite_crew_moderator(text) to authenticated;
grant execute on function public.crew_invitation_overview() to authenticated;
grant execute on function public.update_crew_invitation(uuid,text) to authenticated;
grant execute on function public.get_shared_crew_space(text) to authenticated;
grant execute on function public.save_shared_crew_item(text,uuid,text,text,text,timestamptz,boolean) to authenticated;
grant execute on function public.delete_shared_crew_item(text,uuid) to authenticated;
