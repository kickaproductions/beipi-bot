-- Pending suggestions can be edited by their author or the owning streamer.

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
    'streams',case when allowed then coalesce((
      select jsonb_agg(jsonb_build_object('id',item.id,'title',item.title,'note',item.note,'due',item.due,'pinned',item.pinned) order by item.pinned desc,item.due)
      from public.companion_items item
      where item.user_id=owner_connection.user_id and item.kind='crew-stream' and item.done=false and item.due>=now()
        and (item.due<now()+interval '1 month' or item.pinned=true)
    ),'[]'::jsonb) else '[]'::jsonb end,
    'items',case when allowed then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',item.id,'kind',item.kind,'title',item.title,'note',item.note,'due',item.due,'done',item.done,
        'approvalStatus',item.approval_status,'createdAt',item.created_at,
        'createdByName',coalesce(nullif(creator_profile.username,''),nullif(creator_connection.display_name,''),nullif(creator_profile.display_name,''),'Crew member'),
        'createdByUsername',coalesce(creator_profile.username,creator_connection.username),
        'canEdit',(item.created_by_user_id=auth.uid() or owner_connection.user_id=auth.uid())
      ) order by item.done,item.due nulls last,item.created_at desc)
      from public.crew_shared_items item
      left join public.profiles creator_profile on creator_profile.id=item.created_by_user_id
      left join public.platform_connections creator_connection on creator_connection.user_id=item.created_by_user_id and creator_connection.platform='twitch'
      where item.owner_user_id=owner_connection.user_id and item.approval_status='pending'
    ),'[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

create or replace function public.save_shared_crew_item(target_broadcaster_id text,item_id uuid,item_kind text,item_title text,item_note text,item_due timestamptz,item_done boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  owner_id uuid;
  saved public.crew_shared_items;
  linked_id uuid;
  creator_name text;
  companion_kind text;
  next_order integer;
  result jsonb;
begin
  select user_id into owner_id from public.platform_connections where platform='twitch' and external_user_id=target_broadcaster_id limit 1;
  if owner_id is null or not (owner_id=auth.uid() or exists(select 1 from public.crew_invitations where owner_user_id=owner_id and collaborator_user_id=auth.uid() and status='accepted')) then raise exception 'Shared space access required'; end if;
  if item_kind not in ('task','note') or length(trim(item_title))<1 then raise exception 'Invalid shared item'; end if;
  if item_id is null then
    insert into public.crew_shared_items(owner_user_id,created_by_user_id,kind,title,note,due,done,approval_status,approved_at)
    values(owner_id,auth.uid(),item_kind,left(trim(item_title),200),left(coalesce(item_note,''),2000),item_due,coalesce(item_done,false),case when owner_id=auth.uid() then 'approved' else 'pending' end,case when owner_id=auth.uid() then now() else null end)
    returning * into saved;
  else
    update public.crew_shared_items set title=left(trim(item_title),200),note=left(coalesce(item_note,''),2000),due=item_due,done=coalesce(item_done,false),updated_at=now()
    where id=item_id and owner_user_id=owner_id and approval_status='pending'
      and (created_by_user_id=auth.uid() or owner_id=auth.uid())
    returning * into saved;
  end if;
  if saved.id is null then raise exception 'Shared item not found or cannot be edited'; end if;

  result:=jsonb_build_object('id',saved.id,'kind',saved.kind,'title',saved.title,'note',saved.note,'due',saved.due,'done',saved.done,'approvalStatus',saved.approval_status,'createdAt',saved.created_at);

  if saved.approval_status='approved' then
    companion_kind:=case when saved.kind='task' then 'reminder' else 'idea' end;
    select coalesce(nullif(p.username,''),nullif(c.display_name,''),nullif(p.display_name,''),'Crew member') into creator_name
      from public.profiles p left join public.platform_connections c on c.user_id=p.id and c.platform='twitch' where p.id=saved.created_by_user_id limit 1;
    select coalesce(max(sort_order)+1,0) into next_order from public.companion_items where user_id=owner_id and kind=companion_kind;
    insert into public.companion_items(user_id,kind,title,note,due,done,priority,sort_order,shared_added_by_user_id,shared_added_by_name)
    values(owner_id,companion_kind,saved.title,saved.note,case when saved.kind='task' then saved.due else null end,saved.done,'medium',next_order,saved.created_by_user_id,creator_name)
    returning id into linked_id;
    delete from public.crew_shared_items where id=saved.id;
  end if;
  return result;
end;
$$;

revoke all on function public.get_shared_crew_space(text) from public;
grant execute on function public.get_shared_crew_space(text) to authenticated;
revoke all on function public.save_shared_crew_item(text,uuid,text,text,text,timestamptz,boolean) from public;
grant execute on function public.save_shared_crew_item(text,uuid,text,text,text,timestamptz,boolean) to authenticated;
