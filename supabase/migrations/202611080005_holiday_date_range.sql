alter table public.stream_confirmation_settings
  add column if not exists holiday_start date,
  add column if not exists holiday_end date;

update public.stream_confirmation_settings
set holiday_mode = false
where holiday_mode = true
  and (holiday_start is null or holiday_end is null);

alter table public.stream_confirmation_settings
  drop constraint if exists stream_confirmation_settings_holiday_dates_check;

alter table public.stream_confirmation_settings
  add constraint stream_confirmation_settings_holiday_dates_check
  check (
    holiday_mode = false
    or (
      holiday_start is not null
      and holiday_end is not null
      and holiday_end >= holiday_start
    )
  );
