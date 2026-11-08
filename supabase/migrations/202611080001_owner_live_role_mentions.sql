alter table public.discord_live_settings
  add column if not exists owner_role_id text,
  add column if not exists owner_role_name text;
