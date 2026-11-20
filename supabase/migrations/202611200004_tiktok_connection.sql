alter table public.platform_connections
  drop constraint if exists platform_connections_platform_check,
  add constraint platform_connections_platform_check
  check (platform in ('twitch', 'discord', 'google', 'tiktok'));
