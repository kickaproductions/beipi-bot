create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','developer')),
  founding_tester boolean not null default false,
  lifetime_free boolean not null default false,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "People can read their own profile" on public.profiles for select using (auth.uid()=id);
create policy "People can update their own public profile" on public.profiles for update using (auth.uid()=id) with check (auth.uid()=id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,display_name,avatar_url)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'display_name',new.raw_user_meta_data->>'full_name'),new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
