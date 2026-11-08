alter table public.companion_items
  add column if not exists checklist_phase text not null default 'pre',
  add column if not exists sort_order integer not null default 0,
  add column if not exists created_by_pip boolean not null default false,
  add column if not exists series_id uuid,
  add column if not exists recurrence text,
  add column if not exists recurrence_ongoing boolean not null default false;

alter table public.companion_items
  drop constraint if exists companion_items_checklist_phase_check;

alter table public.companion_items
  add constraint companion_items_checklist_phase_check
  check (checklist_phase in ('pre', 'post'));

alter table public.companion_items
  drop constraint if exists companion_items_recurrence_check;

alter table public.companion_items
  add constraint companion_items_recurrence_check
  check (recurrence is null or recurrence in ('weekly', 'fortnightly', 'monthly'));

create unique index if not exists companion_items_series_due_idx
  on public.companion_items(user_id, series_id, due);

create index if not exists companion_items_checklist_order_idx
  on public.companion_items(user_id, checklist_phase, sort_order)
  where kind = 'checklist';
