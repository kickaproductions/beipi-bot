alter table public.stream_confirmation_settings
  add column if not exists post_to_discord boolean not null default true;

alter table public.stream_confirmation_settings
  drop constraint if exists stream_confirmation_settings_check;

alter table public.stream_confirmation_settings
  add constraint stream_confirmation_settings_destination_check
  check (not enabled or not post_to_discord or (guild_id is not null and channel_id is not null));
