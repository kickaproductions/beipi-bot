create table if not exists public.twitch_panel_appearance (
  user_id uuid primary key references auth.users(id) on delete cascade,
  appearance jsonb not null check (jsonb_typeof(appearance) = 'object')
);

alter table public.twitch_panel_appearance enable row level security;
revoke all on public.twitch_panel_appearance from public, anon, authenticated;
grant select, insert, update on public.twitch_panel_appearance to service_role;
