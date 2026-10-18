create table if not exists public.discord_reaction_menus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  guild_id text not null,
  guild_name text not null,
  channel_id text not null,
  channel_name text not null,
  message_id text not null unique,
  title text not null,
  remove_on_unreact boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discord_reaction_role_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.discord_reaction_menus(id) on delete cascade,
  emoji text not null,
  role_id text not null,
  role_name text not null,
  created_at timestamptz not null default now(),
  unique(menu_id,emoji)
);

create index if not exists discord_reaction_menus_guild_idx on public.discord_reaction_menus(guild_id,active);
create index if not exists discord_reaction_items_menu_idx on public.discord_reaction_role_items(menu_id);
alter table public.discord_reaction_menus enable row level security;
alter table public.discord_reaction_role_items enable row level security;
create policy "People can read their reaction menus" on public.discord_reaction_menus for select using(auth.uid()=user_id);
create policy "People can add their reaction menus" on public.discord_reaction_menus for insert with check(auth.uid()=user_id);
create policy "People can update their reaction menus" on public.discord_reaction_menus for update using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "People can delete their reaction menus" on public.discord_reaction_menus for delete using(auth.uid()=user_id);
create policy "People can read their reaction items" on public.discord_reaction_role_items for select using(exists(select 1 from public.discord_reaction_menus menu where menu.id=menu_id and menu.user_id=auth.uid()));
create policy "People can add their reaction items" on public.discord_reaction_role_items for insert with check(exists(select 1 from public.discord_reaction_menus menu where menu.id=menu_id and menu.user_id=auth.uid()));
create policy "People can update their reaction items" on public.discord_reaction_role_items for update using(exists(select 1 from public.discord_reaction_menus menu where menu.id=menu_id and menu.user_id=auth.uid()));
create policy "People can delete their reaction items" on public.discord_reaction_role_items for delete using(exists(select 1 from public.discord_reaction_menus menu where menu.id=menu_id and menu.user_id=auth.uid()));
