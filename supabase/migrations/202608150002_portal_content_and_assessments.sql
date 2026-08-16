begin;

-- The first draft treated every piece of content as a generic task. The Figma
-- flow distinguishes theory, quizzes and free answers, so replace that draft.
drop table if exists public.user_task_progress;
drop table if exists public.tasks;
drop type if exists public.task_status;

-- Remove the single placeholder record created by the first development seed.
-- Real content is inserted by the new seed after all migrations are applied.
delete from public.subjects where slug = 'demo-subject';

alter table public.subjects
  add column code text,
  add column subtitle text,
  add column theme text not null default 'blue' check (theme in ('blue', 'olive')),
  add column position integer,
  add column estimated_minutes integer not null default 0 check (estimated_minutes >= 0);

update public.subjects
set code = '00', subtitle = coalesce(description, ''), position = 1
where code is null;

alter table public.subjects
  alter column code set not null,
  alter column subtitle set not null,
  alter column position set not null,
  add constraint subjects_code_unique unique (code),
  add constraint subjects_position_unique unique (position),
  add constraint subjects_position_positive check (position > 0);

alter table public.modules
  add column summary text not null default 'Теория + тест',
  add column estimated_minutes integer check (estimated_minutes >= 0),
  add column objective text,
  add column key_principle text,
  add column short_summary text,
  add column learning_tip text;

create type public.activity_type as enum ('theory', 'quiz', 'free_answer');
create type public.progress_status as enum ('not_started', 'in_progress', 'completed');
create type public.attempt_status as enum ('draft', 'submitted', 'reviewing', 'completed');

create table public.module_sections (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null,
  body text not null,
  position integer not null check (position > 0),
  unique (module_id, position)
);

create table public.learning_activities (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  type public.activity_type not null,
  title text not null,
  description text,
  position integer not null check (position > 0),
  estimated_minutes integer check (estimated_minutes >= 0),
  prompt text,
  instructions text,
  hint text,
  max_length integer check (max_length is null or max_length > 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, position)
);

create table public.activity_questions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.learning_activities(id) on delete cascade,
  prompt text not null,
  instructions text not null default 'Выберите один вариант.',
  hint text,
  position integer not null check (position > 0),
  unique (activity_id, position)
);

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.activity_questions(id) on delete cascade,
  label text not null,
  text text not null,
  position integer not null check (position > 0),
  unique (question_id, position),
  unique (question_id, label)
);

-- Correct answers are intentionally isolated from browser-readable options.
create table public.question_answer_keys (
  question_id uuid primary key references public.activity_questions(id) on delete cascade,
  correct_option_id uuid not null references public.question_options(id) on delete cascade,
  explanation text
);

create table public.evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.learning_activities(id) on delete cascade,
  title text not null,
  weight_percent smallint not null check (weight_percent between 1 and 100),
  position integer not null check (position > 0),
  unique (activity_id, position)
);

create table public.user_activity_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null references public.learning_activities(id) on delete cascade,
  status public.progress_status not null default 'not_started',
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, activity_id)
);

create table public.activity_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null references public.learning_activities(id) on delete cascade,
  status public.attempt_status not null default 'draft',
  current_position integer not null default 1 check (current_position > 0),
  score smallint check (score between 0 and 100),
  result_label text,
  result_summary text,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.quiz_answers (
  attempt_id uuid not null references public.activity_attempts(id) on delete cascade,
  question_id uuid not null references public.activity_questions(id) on delete cascade,
  selected_option_id uuid not null references public.question_options(id) on delete cascade,
  is_correct boolean,
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

create table public.free_answer_submissions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.activity_attempts(id) on delete cascade,
  answer text not null default '',
  ai_strength text,
  ai_improvement text,
  ai_recommendation text,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.criterion_scores (
  submission_id uuid not null references public.free_answer_submissions(id) on delete cascade,
  criterion_id uuid not null references public.evaluation_criteria(id) on delete cascade,
  score smallint not null check (score between 0 and 100),
  feedback text,
  primary key (submission_id, criterion_id)
);

create table public.daily_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid references public.learning_activities(id) on delete set null,
  scheduled_for date not null default current_date,
  title text not null,
  estimated_minutes integer not null check (estimated_minutes > 0),
  is_completed boolean not null default false,
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scheduled_for, position)
);

create index module_sections_module_id_idx on public.module_sections(module_id);
create index learning_activities_module_id_idx on public.learning_activities(module_id);
create index activity_questions_activity_id_idx on public.activity_questions(activity_id);
create index question_options_question_id_idx on public.question_options(question_id);
create index activity_attempts_user_id_idx on public.activity_attempts(user_id);
create index activity_attempts_activity_id_idx on public.activity_attempts(activity_id);
create index daily_plan_items_user_date_idx on public.daily_plan_items(user_id, scheduled_for);

create trigger learning_activities_set_updated_at
before update on public.learning_activities
for each row execute function public.set_updated_at();

create trigger user_activity_progress_set_updated_at
before update on public.user_activity_progress
for each row execute function public.set_updated_at();

create trigger activity_attempts_set_updated_at
before update on public.activity_attempts
for each row execute function public.set_updated_at();

create trigger free_answer_submissions_set_updated_at
before update on public.free_answer_submissions
for each row execute function public.set_updated_at();

create trigger daily_plan_items_set_updated_at
before update on public.daily_plan_items
for each row execute function public.set_updated_at();

alter table public.module_sections enable row level security;
alter table public.learning_activities enable row level security;
alter table public.activity_questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_answer_keys enable row level security;
alter table public.evaluation_criteria enable row level security;
alter table public.user_activity_progress enable row level security;
alter table public.activity_attempts enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.free_answer_submissions enable row level security;
alter table public.criterion_scores enable row level security;
alter table public.daily_plan_items enable row level security;

create policy "Module sections are readable"
on public.module_sections for select to anon, authenticated
using (exists (
  select 1 from public.modules module
  where module.id = module_sections.module_id and module.is_published
));

create policy "Published activities are readable"
on public.learning_activities for select to anon, authenticated using (is_published);

create policy "Questions of published activities are readable"
on public.activity_questions for select to anon, authenticated
using (exists (
  select 1 from public.learning_activities activity
  where activity.id = activity_questions.activity_id and activity.is_published
));

create policy "Options of published questions are readable"
on public.question_options for select to anon, authenticated
using (exists (
  select 1
  from public.activity_questions question
  join public.learning_activities activity on activity.id = question.activity_id
  where question.id = question_options.question_id and activity.is_published
));

create policy "Criteria of published activities are readable"
on public.evaluation_criteria for select to anon, authenticated
using (exists (
  select 1 from public.learning_activities activity
  where activity.id = evaluation_criteria.activity_id and activity.is_published
));

create policy "Users manage their activity progress"
on public.user_activity_progress for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage their attempts"
on public.activity_attempts for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage answers in their attempts"
on public.quiz_answers for all to authenticated
using (exists (
  select 1 from public.activity_attempts attempt
  where attempt.id = quiz_answers.attempt_id and attempt.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.activity_attempts attempt
  where attempt.id = quiz_answers.attempt_id and attempt.user_id = (select auth.uid())
));

create policy "Users manage their free answers"
on public.free_answer_submissions for all to authenticated
using (exists (
  select 1 from public.activity_attempts attempt
  where attempt.id = free_answer_submissions.attempt_id
    and attempt.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.activity_attempts attempt
  where attempt.id = free_answer_submissions.attempt_id
    and attempt.user_id = (select auth.uid())
));

create policy "Users read their criterion scores"
on public.criterion_scores for select to authenticated
using (exists (
  select 1
  from public.free_answer_submissions submission
  join public.activity_attempts attempt on attempt.id = submission.attempt_id
  where submission.id = criterion_scores.submission_id
    and attempt.user_id = (select auth.uid())
));

create policy "Users manage their daily plan"
on public.daily_plan_items for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select on public.module_sections, public.learning_activities,
  public.activity_questions, public.question_options, public.evaluation_criteria
  to anon, authenticated;

grant select, insert, update, delete on public.user_activity_progress,
  public.daily_plan_items to authenticated;

-- The browser may save a user's work, but it cannot award scores or write AI
-- feedback. Those fields are reserved for a trusted server/Edge Function.
grant select on public.activity_attempts to authenticated;
grant insert (user_id, activity_id, status, current_position)
  on public.activity_attempts to authenticated;
grant update (status, current_position, submitted_at)
  on public.activity_attempts to authenticated;

grant select on public.quiz_answers to authenticated;
grant insert (attempt_id, question_id, selected_option_id, answered_at)
  on public.quiz_answers to authenticated;
grant update (selected_option_id, answered_at)
  on public.quiz_answers to authenticated;
grant delete on public.quiz_answers to authenticated;

grant select on public.free_answer_submissions to authenticated;
grant insert (attempt_id, answer) on public.free_answer_submissions to authenticated;
grant update (answer) on public.free_answer_submissions to authenticated;
grant delete on public.free_answer_submissions to authenticated;

grant select on public.criterion_scores to authenticated;
revoke all on public.question_answer_keys from anon, authenticated;

grant all on public.module_sections, public.learning_activities,
  public.activity_questions, public.question_options, public.question_answer_keys,
  public.evaluation_criteria, public.user_activity_progress,
  public.activity_attempts, public.quiz_answers, public.free_answer_submissions,
  public.criterion_scores, public.daily_plan_items to service_role;

commit;
