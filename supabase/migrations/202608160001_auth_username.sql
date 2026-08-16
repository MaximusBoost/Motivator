begin;

alter table public.profiles
  add column username text;

update public.profiles
set username = coalesce(
  nullif(trim(display_name), ''),
  'user_' || left(replace(id::text, '-', ''), 8)
)
where username is null;

alter table public.profiles
  alter column username set not null,
  add constraint profiles_username_length
    check (char_length(username) between 3 and 24),
  add constraint profiles_username_trimmed
    check (username = trim(username));

create unique index profiles_username_lower_unique
  on public.profiles (lower(username));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  requested_username text;
begin
  requested_username := trim(coalesce(
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'display_name',
    ''
  ));

  if char_length(requested_username) not between 3 and 24 then
    raise exception 'Username must contain between 3 and 24 characters';
  end if;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    requested_username,
    coalesce(new.raw_user_meta_data ->> 'display_name', requested_username),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  return new;
end;
$$;

commit;
