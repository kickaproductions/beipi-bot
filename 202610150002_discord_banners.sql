insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('discord-banners','discord-banners',false,5242880,array['image/png','image/jpeg','image/webp','image/gif'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.discord_banners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  byte_size integer not null check(byte_size>0 and byte_size<=5242880),
  created_at timestamptz not null default now()
);
alter table public.discord_banners enable row level security;
create policy "People can read their own Discord banners" on public.discord_banners for select using(auth.uid()=user_id);
create policy "People can add their own Discord banners" on public.discord_banners for insert with check(auth.uid()=user_id);
create policy "People can delete their own Discord banners" on public.discord_banners for delete using(auth.uid()=user_id);
create policy "People can upload their own Discord banner files" on storage.objects for insert with check(bucket_id='discord-banners' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "People can read their own Discord banner files" on storage.objects for select using(bucket_id='discord-banners' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "People can delete their own Discord banner files" on storage.objects for delete using(bucket_id='discord-banners' and (storage.foldername(name))[1]=auth.uid()::text);
