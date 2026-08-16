begin;

create extension if not exists pgcrypto;

create type public.task_status as enum (
  'not_started',
  'in_progress',
  'completed'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  position integer not null check (position > 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, position)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null,
  description text,
  position integer not null check (position > 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, position)
);

create table public.user_task_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  status public.task_status not null default 'not_started',
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, task_id)
);

create index modules_subject_id_idx on public.modules(subject_id);
create index tasks_module_id_idx on public.tasks(module_id);
create index user_task_progress_user_id_idx on public.user_task_progress(user_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger subjects_set_updated_at
before update on public.subjects
for each row execute function public.set_updated_at();

create trigger modules_set_updated_at
before update on public.modules
for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.modules enable row level security;
alter table public.tasks enable row level security;
alter table public.user_task_progress enable row level security;

create policy "Published subjects are readable"
on public.subjects for select
to anon, authenticated
using (is_published);

create policy "Published modules are readable"
on public.modules for select
to anon, authenticated
using (is_published);

create policy "Published tasks are readable"
on public.tasks for select
to anon, authenticated
using (is_published);

create policy "Users can read their profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can update their profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users can read their progress"
on public.user_task_progress for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their progress"
on public.user_task_progress for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their progress"
on public.user_task_progress for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their progress"
on public.user_task_progress for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select on public.subjects, public.modules, public.tasks to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.user_task_progress to authenticated;

commit;
