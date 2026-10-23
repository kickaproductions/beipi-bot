alter table public.stream_confirmation_settings
  add column if not exists message_template text not null default E'# Stream in 1 hour!\n\n{username} is streaming {game}, see you soon!\n\n{embed}\n\n@{role}',
  add column if not exists cancel_message_template text not null default E'# Stream Cancelled\n\n{username} has cancelled their stream.',
  add column if not exists role_id text,
  add column if not exists role_name text;

update public.stream_confirmation_settings
set cancel_message_template=E'# Stream Cancelled\n\n{username} has cancelled their stream.'
where cancel_message_template=E'# Stream Cancelled\n\n{username} has cancelled their stream tonight.';
