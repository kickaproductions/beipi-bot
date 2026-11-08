alter table public.companion_items
  add column if not exists priority text not null default 'medium';

alter table public.companion_items
  drop constraint if exists companion_items_priority_check;

alter table public.companion_items
  add constraint companion_items_priority_check
  check (priority in ('low', 'medium', 'high'));
