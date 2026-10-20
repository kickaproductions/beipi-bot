-- Allow My Crew tasks, schedules and retained milestone records to use the
-- existing account-owned companion_items table.
alter table public.companion_items
  drop constraint if exists companion_items_kind_check;

alter table public.companion_items
  add constraint companion_items_kind_check
  check (
    kind in (
      'reminder',
      'checklist',
      'idea',
      'connection',
      'crew-task',
      'crew-stream',
      'crew-milestone'
    )
  );
