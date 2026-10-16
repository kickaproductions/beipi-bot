alter table public.discord_live_settings
  add column if not exists owner_alert_channel_id text,
  add column if not exists owner_alert_channel_name text,
  add column if not exists owner_everyone_enabled boolean not null default true;
