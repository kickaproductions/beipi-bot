create table if not exists public.companion_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('reminder','checklist','idea','connection')),
  title text not null check (char_length(title) between 1 and 200),
  note text not null default '' check (char_length(note) <= 2000),
  due timestamptz,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companion_items_user_created_idx
  on public.companion_items(user_id,created_at desc);

alter table public.companion_items enable row level security;

drop policy if exists "People can read their own companion items" on public.companion_items;
create policy "People can read their own companion items"
  on public.companion_items for select
  using (auth.uid()=user_id);

drop policy if exists "People can create their own companion items" on public.companion_items;
create policy "People can create their own companion items"
  on public.companion_items for insert
  with check (auth.uid()=user_id);

drop policy if exists "People can update their own companion items" on public.companion_items;
create policy "People can update their own companion items"
  on public.companion_items for update
  using (auth.uid()=user_id)
  with check (auth.uid()=user_id);

drop policy if exists "People can delete their own companion items" on public.companion_items;
create policy "People can delete their own companion items"
  on public.companion_items for delete
  using (auth.uid()=user_id);
