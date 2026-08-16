begin;

create table public.user_subject_goals (
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  target_grade smallint not null check (target_grade between 2 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, subject_id)
);

create index user_subject_goals_user_id_idx
  on public.user_subject_goals(user_id);

create trigger user_subject_goals_set_updated_at
before update on public.user_subject_goals
for each row execute function public.set_updated_at();

alter table public.user_subject_goals enable row level security;

create policy "Users manage their subject goals"
on public.user_subject_goals for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete
  on public.user_subject_goals to authenticated;

grant all on public.user_subject_goals to service_role;

commit;
