create extension if not exists pgcrypto;

alter table public.crew_invitations alter column collaborator_user_id drop not null;
alter table public.crew_invitations add column if not exists invite_token_hash text unique;
alter table public.crew_invitations add column if not exists expires_at timestamptz;
alter table public.crew_invitations add column if not exists accepted_at timestamptz;

create index if not exists crew_invitations_token_idx on public.crew_invitations(invite_token_hash) where invite_token_hash is not null;

drop function if exists public.invite_crew_moderator(text);

create or replace function public.create_crew_invite_link()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  caller_id uuid:=auth.uid();
  raw_token text;
  invitation_id uuid;
  owner_twitch_id text;
begin
  if caller_id is null then raise exception 'Not signed in'; end if;
  select external_user_id into owner_twitch_id from public.platform_connections
    where user_id=caller_id and platform='twitch' limit 1;
  if owner_twitch_id is null then
    return jsonb_build_object('ok',false,'error','Connect Twitch before creating a shared-space link.');
  end if;

  update public.crew_invitations set status='revoked',invite_token_hash=null,updated_at=now()
    where owner_user_id=caller_id and collaborator_user_id is null and status='pending';
  raw_token:=encode(gen_random_bytes(32),'hex');
  insert into public.crew_invitations(owner_user_id,collaborator_user_id,status,invite_token_hash,expires_at,updated_at)
    values(caller_id,null,'pending',encode(digest(raw_token,'sha256'),'hex'),now()+interval '7 days',now())
    returning id into invitation_id;
  return jsonb_build_object('ok',true,'token',raw_token,'invitationId',invitation_id,'expiresAt',now()+interval '7 days');
end;
$$;

create or replace function public.accept_crew_invite_link(invite_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  caller_id uuid:=auth.uid();
  invitation public.crew_invitations;
  owner_connection public.platform_connections;
begin
  if caller_id is null then raise exception 'Not signed in'; end if;
  select * into invitation from public.crew_invitations
    where invite_token_hash=encode(digest(invite_token,'sha256'),'hex')
      and status='pending' and expires_at>now()
    for update;
  if invitation.id is null then
    return jsonb_build_object('ok',false,'error','This invitation is invalid, expired or has already been used.');
  end if;
  if invitation.owner_user_id=caller_id then
    return jsonb_build_object('ok',false,'error','You cannot accept your own invitation.');
  end if;

  delete from public.crew_invitations
    where owner_user_id=invitation.owner_user_id and collaborator_user_id=caller_id and id<>invitation.id;
  update public.crew_invitations set collaborator_user_id=caller_id,status='accepted',accepted_at=now(),invite_token_hash=null,updated_at=now()
    where id=invitation.id;
  select * into owner_connection from public.platform_connections
    where user_id=invitation.owner_user_id and platform='twitch' limit 1;
  return jsonb_build_object('ok',true,'broadcasterId',owner_connection.external_user_id,'displayName',coalesce(owner_connection.display_name,'your streamer'));
end;
$$;

create or replace function public.crew_invitation_overview()
returns jsonb language sql security definer set search_path=public stable as $$
  select jsonb_build_object(
    'sent',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'status',i.status,
        'displayName',case when i.collaborator_user_id is null then 'Invite link' else coalesce(c.display_name,p.display_name,'B.E.I.P.I. user') end,
        'username',c.username,'avatarUrl',c.avatar_url,'updatedAt',i.updated_at,'expiresAt',i.expires_at
      ) order by i.updated_at desc)
      from public.crew_invitations i
      left join public.platform_connections c on c.user_id=i.collaborator_user_id and c.platform='twitch'
      left join public.profiles p on p.id=i.collaborator_user_id
      where i.owner_user_id=auth.uid()
    ),'[]'::jsonb),
    'received',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'status',i.status,'displayName',coalesce(c.display_name,p.display_name,'B.E.I.P.I. streamer'),
        'username',c.username,'avatarUrl',c.avatar_url,'broadcasterId',c.external_user_id,'updatedAt',i.updated_at
      ) order by i.updated_at desc)
      from public.crew_invitations i
      left join public.platform_connections c on c.user_id=i.owner_user_id and c.platform='twitch'
      left join public.profiles p on p.id=i.owner_user_id
      where i.collaborator_user_id=auth.uid()
    ),'[]'::jsonb)
  );
$$;

grant execute on function public.create_crew_invite_link() to authenticated;
grant execute on function public.accept_crew_invite_link(text) to authenticated;
