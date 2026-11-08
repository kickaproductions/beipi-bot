-- Multiple notification mentions for personal and community live alerts.

alter table public.discord_owner_live_settings
  add column if not exists mention_role_ids text[] not null default '{}'::text[],
  add column if not exists mention_role_names text[] not null default '{}'::text[];

alter table public.discord_live_settings
  add column if not exists mention_role_ids text[] not null default '{}'::text[],
  add column if not exists mention_role_names text[] not null default '{}'::text[];

-- Preserve each existing personal notification role as the first selected role.
update public.discord_owner_live_settings
set
  mention_role_ids=array[role_id],
  mention_role_names=case when role_name is null or role_name='' then '{}'::text[] else array[role_name] end
where role_id is not null
  and role_id<>''
  and cardinality(mention_role_ids)=0;
