begin;

create or replace function public.submit_quiz(
  p_activity_id uuid,
  p_answers jsonb
)
returns table (
  attempt_id uuid,
  score integer,
  correct_answers integer,
  total_questions integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  new_attempt_id uuid;
  correct_count integer;
  question_count integer;
  calculated_score integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.learning_activities activity
    where activity.id = p_activity_id
      and activity.type = 'quiz'
      and activity.is_published
  ) then
    raise exception 'Quiz not found';
  end if;

  select count(*)::integer
  into question_count
  from public.activity_questions question
  where question.activity_id = p_activity_id;

  if question_count = 0 then
    raise exception 'Quiz has no questions';
  end if;

  if jsonb_object_length(p_answers) <> question_count then
    raise exception 'Every question must be answered';
  end if;

  insert into public.activity_attempts (
    user_id,
    activity_id,
    status,
    current_position
  )
  values (
    current_user_id,
    p_activity_id,
    'submitted',
    question_count
  )
  returning id into new_attempt_id;

  insert into public.quiz_answers (
    attempt_id,
    question_id,
    selected_option_id,
    is_correct
  )
  select
    new_attempt_id,
    question.id,
    selected.value::uuid,
    answer_key.correct_option_id = selected.value::uuid
  from public.activity_questions question
  cross join lateral (
    select p_answers ->> question.id::text as value
  ) selected
  join public.question_options option
    on option.id = selected.value::uuid
    and option.question_id = question.id
  join public.question_answer_keys answer_key
    on answer_key.question_id = question.id
  where question.activity_id = p_activity_id;

  if (
    select count(*)
    from public.quiz_answers answer
    where answer.attempt_id = new_attempt_id
  ) <> question_count then
    raise exception 'One or more answers are invalid';
  end if;

  select count(*) filter (where answer.is_correct)::integer
  into correct_count
  from public.quiz_answers answer
  where answer.attempt_id = new_attempt_id;

  calculated_score := round(correct_count * 100.0 / question_count)::integer;

  update public.activity_attempts
  set
    status = 'completed',
    score = calculated_score,
    result_label = case
      when calculated_score >= 90 then 'Отличный результат'
      when calculated_score >= 75 then 'Хороший результат'
      when calculated_score >= 60 then 'Тест пройден'
      else 'Нужно повторить тему'
    end,
    result_summary = format(
      'Правильных ответов: %s из %s.',
      correct_count,
      question_count
    ),
    submitted_at = now(),
    completed_at = now()
  where id = new_attempt_id;

  insert into public.user_activity_progress (
    user_id,
    activity_id,
    status,
    progress_percent
  )
  values (
    current_user_id,
    p_activity_id,
    'completed',
    100
  )
  on conflict (user_id, activity_id)
  do update set
    status = excluded.status,
    progress_percent = excluded.progress_percent;

  return query
  select new_attempt_id, calculated_score, correct_count, question_count;
end;
$$;

revoke all on function public.submit_quiz(uuid, jsonb) from public;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;

commit;
