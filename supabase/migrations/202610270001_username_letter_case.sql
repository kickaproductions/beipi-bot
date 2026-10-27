alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[A-Za-z0-9_]{3,24}$');

create or replace function public.update_my_username(new_username text)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  cleaned text:=trim(coalesce(new_username,''));
begin
  if cleaned !~ '^[A-Za-z0-9_]{3,24}$' then
    raise exception 'Username must be 3–24 characters using letters, numbers or underscores.';
  end if;
  if exists(select 1 from public.profiles where lower(username)=lower(cleaned) and id<>auth.uid()) then
    raise exception 'That username is already taken.';
  end if;
  update public.profiles set username=cleaned,updated_at=now() where id=auth.uid();
  if not found then raise exception 'Account profile not found.'; end if;
  return cleaned;
end;
$$;

revoke all on function public.update_my_username(text) from public;
grant execute on function public.update_my_username(text) to authenticated;
