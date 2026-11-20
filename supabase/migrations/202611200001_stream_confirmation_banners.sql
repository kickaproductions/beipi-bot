alter table public.stream_confirmation_settings
  add column if not exists reminder_banner_id uuid references public.discord_banners(id) on delete set null,
  add column if not exists cancellation_banner_id uuid references public.discord_banners(id) on delete set null;
