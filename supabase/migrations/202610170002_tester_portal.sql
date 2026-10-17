create table if not exists public.tester_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('bug','feature','general')),
  area text not null,
  title text not null,
  description text not null,
  expected_result text,
  actual_result text,
  severity text not null default 'minor' check (severity in ('minor','disruptive','blocking')),
  status text not null default 'received' check (status in ('received','reviewing','planned','fixed','closed')),
  developer_response text,
  screenshot_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tester_feedback_user_created_idx on public.tester_feedback(user_id,created_at desc);
create index if not exists tester_feedback_status_created_idx on public.tester_feedback(status,created_at desc);
alter table public.tester_feedback enable row level security;
create policy "Testers can read their feedback" on public.tester_feedback for select using (auth.uid()=user_id or exists(select 1 from public.profiles where id=auth.uid() and role='developer'));
create policy "Founding testers can submit feedback" on public.tester_feedback for insert with check (auth.uid()=user_id and exists(select 1 from public.profiles where id=auth.uid() and (founding_tester or role='developer')));
create policy "Developers can update feedback" on public.tester_feedback for update using (exists(select 1 from public.profiles where id=auth.uid() and role='developer')) with check (exists(select 1 from public.profiles where id=auth.uid() and role='developer'));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('tester-feedback','tester-feedback',false,5242880,array['image/png','image/jpeg','image/webp']) on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/png','image/jpeg','image/webp'];
create policy "Testers upload their screenshots" on storage.objects for insert to authenticated with check (bucket_id='tester-feedback' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Testers and developers read feedback screenshots" on storage.objects for select to authenticated using (bucket_id='tester-feedback' and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.profiles where id=auth.uid() and role='developer')));
