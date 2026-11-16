alter table public.discord_live_settings
  add column if not exists twitch_watch jsonb not null default '[]'::jsonb
    check (jsonb_typeof(twitch_watch) = 'array');
