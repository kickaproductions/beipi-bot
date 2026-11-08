-- Approved crew suggestions are handed off to the streamer's personal lists.
-- The personal reminder/idea remains, while the shared-space suggestion is removed.

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
    where id=item_id and owner_user_id=owner_id returning * into saved;
  end if;
  if saved.id is null then raise exception 'Shared item not found'; end if;

  result:=jsonb_build_object('id',saved.id,'kind',saved.kind,'title',saved.title,'note',saved.note,'due',saved.due,'done',saved.done,'approvalStatus',saved.approval_status,'createdAt',saved.created_at);

  if saved.approval_status='approved' then
    companion_kind:=case when saved.kind='task' then 'reminder' else 'idea' end;
    select coalesce(nullif(p.username,''),nullif(c.display_name,''),nullif(p.display_name,''),'Crew member') into creator_name
      from public.profiles p left join public.platform_connections c on c.user_id=p.id and c.platform='twitch' where p.id=saved.created_by_user_id limit 1;
    if saved.companion_item_id is null then
      select coalesce(max(sort_order)+1,0) into next_order from public.companion_items where user_id=owner_id and kind=companion_kind;
      insert into public.companion_items(user_id,kind,title,note,due,done,priority,sort_order,shared_added_by_user_id,shared_added_by_name)
      values(owner_id,companion_kind,saved.title,saved.note,case when saved.kind='task' then saved.due else null end,saved.done,'medium',next_order,saved.created_by_user_id,creator_name)
      returning id into linked_id;
    else
      linked_id:=saved.companion_item_id;
      update public.companion_items set title=saved.title,note=saved.note,due=case when saved.kind='task' then saved.due else null end,done=saved.done,updated_at=now()
      where id=linked_id and user_id=owner_id;
    end if;
    delete from public.crew_shared_items where id=saved.id;
  end if;
  return result;
end;
$$;

create or replace function public.approve_shared_crew_item(target_broadcaster_id text,item_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare
  owner_id uuid;
  saved public.crew_shared_items;
  linked_id uuid;
  creator_name text;
  companion_kind text;
  next_order integer;
begin
  select user_id into owner_id from public.platform_connections where platform='twitch' and external_user_id=target_broadcaster_id limit 1;
  if owner_id is null or owner_id<>auth.uid() then return false; end if;
  select * into saved from public.crew_shared_items where id=item_id and owner_user_id=owner_id for update;
  if saved.id is null then return false; end if;

  companion_kind:=case when saved.kind='task' then 'reminder' else 'idea' end;
  select coalesce(nullif(p.username,''),nullif(c.display_name,''),nullif(p.display_name,''),'Crew member') into creator_name
    from public.profiles p left join public.platform_connections c on c.user_id=p.id and c.platform='twitch' where p.id=saved.created_by_user_id limit 1;
  select coalesce(max(sort_order)+1,0) into next_order from public.companion_items where user_id=owner_id and kind=companion_kind;
  insert into public.companion_items(user_id,kind,title,note,due,done,priority,sort_order,shared_added_by_user_id,shared_added_by_name)
  values(owner_id,companion_kind,saved.title,saved.note,case when saved.kind='task' then saved.due else null end,saved.done,'medium',next_order,saved.created_by_user_id,creator_name)
  returning id into linked_id;

  delete from public.crew_shared_items where id=saved.id;
  return true;
end;
$$;

-- Complete the hand-off for suggestions approved before this migration.
delete from public.crew_shared_items where approval_status='approved';

revoke all on function public.save_shared_crew_item(text,uuid,text,text,text,timestamptz,boolean) from public;
grant execute on function public.save_shared_crew_item(text,uuid,text,text,text,timestamptz,boolean) to authenticated;
revoke all on function public.approve_shared_crew_item(text,uuid) from public;
grant execute on function public.approve_shared_crew_item(text,uuid) to authenticated;
