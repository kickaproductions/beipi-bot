delete from public.platform_connections
where platform = 'kick';

alter table public.platform_connections
  drop constraint if exists platform_connections_platform_check;

alter table public.platform_connections
  add constraint platform_connections_platform_check
  check (platform in ('twitch', 'discord', 'google'));
