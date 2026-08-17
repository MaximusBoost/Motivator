begin;

create type public.service_type as enum ('contract', 'conscript');
create type public.personnel_category as enum ('officer', 'warrant_officer', 'sergeant', 'soldier');
create type public.position_profile as enum ('leader', 'specialist', 'primary');
create type public.service_direction as enum (
  'general', 'command', 'technical', 'engineering', 'communications', 'logistics', 'medical_support'
);
create type public.qualification_level as enum ('none', 'third', 'second', 'first', 'master');
create type public.practice_category as enum ('professional', 'physical');

create table public.user_qualification_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_active_service_member boolean not null,
  active_service_confirmed_at timestamptz not null default now(),
  service_type public.service_type not null,
  personnel_category public.personnel_category not null,
  position_profile public.position_profile not null,
  has_subordinates boolean not null default false,
  service_direction public.service_direction not null,
  service_started_at date not null,
  current_qualification public.qualification_level not null default 'none',
  qualification_awarded_at date,
  qualification_expires_at date,
  target_qualification public.qualification_level not null,
  policy_version text not null,
  onboarding_completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint target_qualification_not_none check (target_qualification <> 'none'),
  constraint target_qualification_not_below_current check (
    (case target_qualification
      when 'none' then 0 when 'third' then 1 when 'second' then 2 when 'first' then 3 when 'master' then 4
    end) >=
    (case current_qualification
      when 'none' then 0 when 'third' then 1 when 'second' then 2 when 'first' then 3 when 'master' then 4
    end)
  ),
  constraint active_service_member_required check (is_active_service_member),
  constraint service_start_is_not_future check (service_started_at <= current_date),
  constraint awarded_date_is_not_future check (
    qualification_awarded_at is null or qualification_awarded_at <= current_date
  ),
  constraint conscript_cannot_have_master check (
    not (service_type = 'conscript' and current_qualification = 'master')
  ),
  constraint conscript_cannot_target_master check (
    not (service_type = 'conscript' and target_qualification = 'master')
  ),
  constraint qualification_dates_are_valid check (
    qualification_awarded_at is null
    or qualification_awarded_at >= service_started_at
  ),
  constraint qualification_expiry_is_valid check (
    qualification_expires_at is null
    or qualification_awarded_at is null
    or qualification_expires_at >= qualification_awarded_at
  )
);

create trigger user_qualification_profiles_set_updated_at
before update on public.user_qualification_profiles
for each row execute function public.set_updated_at();

create table public.user_practice_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category public.practice_category not null,
  subject_id uuid references public.subjects(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 160),
  value numeric(12, 3) not null check (value >= 0),
  unit text not null check (length(trim(unit)) between 1 and 40),
  grade smallint not null check (grade between 2 and 5),
  performed_at date not null,
  notes text check (notes is null or length(notes) <= 1000),
  source text not null default 'self_reported' check (source = 'self_reported'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint practice_date_is_not_future check (performed_at <= current_date)
);

create index user_practice_results_user_date_idx
  on public.user_practice_results(user_id, performed_at desc);

create trigger user_practice_results_set_updated_at
before update on public.user_practice_results
for each row execute function public.set_updated_at();

create table public.physical_training_advice (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  based_on_result_id uuid not null references public.user_practice_results(id) on delete cascade,
  summary text not null check (length(summary) between 1 and 1600),
  recommendations jsonb not null check (jsonb_typeof(recommendations) = 'array'),
  caution text not null check (length(caution) between 1 and 1200),
  source text not null default 'ai' check (source = 'ai'),
  generated_at timestamptz not null default now(),
  unique (user_id, based_on_result_id)
);

create index physical_training_advice_user_date_idx
  on public.physical_training_advice(user_id, generated_at desc);

create table public.qualification_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_qualification public.qualification_level not null,
  predicted_qualification public.qualification_level not null default 'none',
  qualifies_for_target boolean not null default false,
  physical_grade smallint check (physical_grade between 2 and 5),
  average_score_percent smallint not null check (average_score_percent between 0 and 100),
  policy_version text not null,
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  constraint exam_target_qualification_not_none check (target_qualification <> 'none')
);

create index qualification_exam_attempts_user_date_idx
  on public.qualification_exam_attempts(user_id, completed_at desc);

create table public.qualification_exam_subject_results (
  attempt_id uuid not null references public.qualification_exam_attempts(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  correct_answers smallint not null check (correct_answers between 0 and 10),
  total_questions smallint not null default 10 check (total_questions = 10),
  score_percent smallint not null check (score_percent between 0 and 100),
  grade smallint not null check (grade between 2 and 5),
  primary key (attempt_id, subject_id)
);

create table public.qualification_exam_answers (
  attempt_id uuid not null references public.qualification_exam_attempts(id) on delete cascade,
  question_id uuid not null references public.activity_questions(id) on delete restrict,
  selected_option_id uuid not null references public.question_options(id) on delete restrict,
  is_correct boolean not null,
  primary key (attempt_id, question_id)
);

alter table public.user_qualification_profiles enable row level security;
alter table public.user_practice_results enable row level security;
alter table public.physical_training_advice enable row level security;
alter table public.qualification_exam_attempts enable row level security;
alter table public.qualification_exam_subject_results enable row level security;
alter table public.qualification_exam_answers enable row level security;

create policy "Users manage their qualification profile"
on public.user_qualification_profiles for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage their practice results"
on public.user_practice_results for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users read their physical training advice"
on public.physical_training_advice for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users read their qualification attempts"
on public.qualification_exam_attempts for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users read their qualification subject results"
on public.qualification_exam_subject_results for select to authenticated
using (exists (
  select 1 from public.qualification_exam_attempts attempt
  where attempt.id = attempt_id and attempt.user_id = (select auth.uid())
));

create policy "Users read their qualification answers"
on public.qualification_exam_answers for select to authenticated
using (exists (
  select 1 from public.qualification_exam_attempts attempt
  where attempt.id = attempt_id and attempt.user_id = (select auth.uid())
));

grant select, insert, update, delete on public.user_qualification_profiles to authenticated;
grant select, insert, update, delete on public.user_practice_results to authenticated;
grant select on public.physical_training_advice to authenticated;
grant select on public.qualification_exam_attempts to authenticated;
grant select on public.qualification_exam_subject_results to authenticated;
grant select on public.qualification_exam_answers to authenticated;
grant all on public.user_qualification_profiles, public.user_practice_results,
  public.physical_training_advice,
  public.qualification_exam_attempts, public.qualification_exam_subject_results,
  public.qualification_exam_answers to service_role;

create or replace function public.submit_qualification_exam(
  p_subject_ids uuid[],
  p_answers jsonb,
  p_started_at timestamptz
)
returns table (attempt_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_subject_count integer;
  answer_count integer;
  valid_answer_count integer;
  current_target public.qualification_level;
  current_service_type public.service_type;
  current_policy text;
  latest_physical_grade smallint;
  new_attempt_id uuid;
  subject_record record;
  subject_correct integer;
  subject_grade smallint;
  total_grades integer;
  excellent_grades integer;
  good_or_better_grades integer;
  minimum_grade integer;
  grade_four_count integer;
  predicted public.qualification_level := 'none';
  target_reached boolean := false;
  average_score integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select profile.target_qualification, profile.policy_version, profile.service_type
  into current_target, current_policy, current_service_type
  from public.user_qualification_profiles profile
  where profile.user_id = current_user_id;

  if current_target is null then
    raise exception 'Qualification profile required';
  end if;

  select count(*)::integer
  into selected_subject_count
  from (select distinct unnest(p_subject_ids) as subject_id) selected;

  if selected_subject_count < 4 then
    raise exception 'At least four subjects are required';
  end if;

  if selected_subject_count <> coalesce(array_length(p_subject_ids, 1), 0) then
    raise exception 'Subject list contains duplicates';
  end if;

  select jsonb_object_length(p_answers) into answer_count;
  if answer_count <> selected_subject_count * 10 then
    raise exception 'Exactly ten answers per subject are required';
  end if;

  select count(*)::integer
  into valid_answer_count
  from jsonb_each_text(p_answers) submitted(question_id, option_id)
  join public.activity_questions question on question.id = submitted.question_id::uuid
  join public.learning_activities activity on activity.id = question.activity_id
  join public.modules module on module.id = activity.module_id
  join public.question_options option
    on option.id = submitted.option_id::uuid and option.question_id = question.id
  join public.question_answer_keys answer_key on answer_key.question_id = question.id
  where module.subject_id = any(p_subject_ids)
    and activity.type = 'quiz'
    and activity.is_published;

  if valid_answer_count <> answer_count then
    raise exception 'One or more answers are invalid';
  end if;

  if exists (
    select 1
    from unnest(p_subject_ids) as selected(subject_id)
    left join lateral (
      select count(*) as answers_for_subject
      from jsonb_each_text(p_answers) submitted(question_id, option_id)
      join public.activity_questions question on question.id = submitted.question_id::uuid
      join public.learning_activities activity on activity.id = question.activity_id
      join public.modules module on module.id = activity.module_id
      where module.subject_id = selected.subject_id
    ) answer_totals on true
    where answer_totals.answers_for_subject <> 10
  ) then
    raise exception 'Every selected subject must contain ten answers';
  end if;

  select result.grade
  into latest_physical_grade
  from public.user_practice_results result
  where result.user_id = current_user_id and result.category = 'physical'
  order by result.performed_at desc, result.created_at desc
  limit 1;

  insert into public.qualification_exam_attempts (
    user_id, target_qualification, physical_grade, average_score_percent,
    policy_version, started_at
  ) values (
    current_user_id, current_target, latest_physical_grade, 0,
    current_policy, least(coalesce(p_started_at, now()), now())
  ) returning id into new_attempt_id;

  insert into public.qualification_exam_answers (
    attempt_id, question_id, selected_option_id, is_correct
  )
  select
    new_attempt_id,
    submitted.question_id::uuid,
    submitted.option_id::uuid,
    answer_key.correct_option_id = submitted.option_id::uuid
  from jsonb_each_text(p_answers) submitted(question_id, option_id)
  join public.question_answer_keys answer_key
    on answer_key.question_id = submitted.question_id::uuid;

  for subject_record in
    select subject.id
    from public.subjects subject
    where subject.id = any(p_subject_ids)
  loop
    select count(*) filter (where answer.is_correct)::integer
    into subject_correct
    from public.qualification_exam_answers answer
    join public.activity_questions question on question.id = answer.question_id
    join public.learning_activities activity on activity.id = question.activity_id
    join public.modules module on module.id = activity.module_id
    where answer.attempt_id = new_attempt_id
      and module.subject_id = subject_record.id;

    subject_grade := case
      when subject_correct >= 9 then 5
      when subject_correct = 8 then 4
      when subject_correct >= 6 then 3
      else 2
    end;

    insert into public.qualification_exam_subject_results (
      attempt_id, subject_id, correct_answers, score_percent, grade
    ) values (
      new_attempt_id, subject_record.id, subject_correct, subject_correct * 10, subject_grade
    );
  end loop;

  select
    count(*)::integer,
    count(*) filter (where result.grade = 5)::integer,
    count(*) filter (where result.grade >= 4)::integer,
    min(result.grade)::integer,
    count(*) filter (where result.grade = 4)::integer,
    round(avg(result.score_percent))::integer
  into total_grades, excellent_grades, good_or_better_grades,
    minimum_grade, grade_four_count, average_score
  from public.qualification_exam_subject_results result
  where result.attempt_id = new_attempt_id;

  if latest_physical_grade is not null and latest_physical_grade >= 3 then
    predicted := case
      when minimum_grade >= 4 and grade_four_count <= 1 then 'master'::public.qualification_level
      when excellent_grades >= ceil(total_grades * 0.7) and minimum_grade >= 4
        then 'first'::public.qualification_level
      when minimum_grade >= 4 then 'second'::public.qualification_level
      when good_or_better_grades >= ceil(total_grades * 0.7) and minimum_grade >= 3
        then 'third'::public.qualification_level
      else 'none'::public.qualification_level
    end;
    if current_service_type = 'conscript' and predicted = 'master' then
      predicted := 'first';
    end if;
  end if;

  target_reached := (case predicted
    when 'none' then 0 when 'third' then 1 when 'second' then 2 when 'first' then 3 when 'master' then 4
  end) >= (case current_target
    when 'none' then 0 when 'third' then 1 when 'second' then 2 when 'first' then 3 when 'master' then 4
  end);

  update public.qualification_exam_attempts
  set predicted_qualification = predicted,
      qualifies_for_target = target_reached,
      average_score_percent = average_score
  where id = new_attempt_id;

  return query select new_attempt_id;
end;
$$;

revoke all on function public.submit_qualification_exam(uuid[], jsonb, timestamptz) from public;
grant execute on function public.submit_qualification_exam(uuid[], jsonb, timestamptz) to authenticated;

commit;
