create table if not exists public.twitch_week_shares (
  user_id uuid primary key references auth.users(id) on delete cascade,
  broadcaster_id text not null unique check (broadcaster_id ~ '^\d{1,20}$')
);

alter table public.twitch_week_shares enable row level security;
revoke all on public.twitch_week_shares from anon, authenticated;
grant select, insert, update, delete on public.twitch_week_shares to service_role;
