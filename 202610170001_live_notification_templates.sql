alter table public.discord_live_settings
  add column if not exists owner_message_template text,
  add column if not exists creator_message_template text;
