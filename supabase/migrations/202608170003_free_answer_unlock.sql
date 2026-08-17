begin;

-- A free-answer task becomes available only after every published quiz in the
-- same module has been completed by the current user. A real quiz completion
-- has a server-written score and completion timestamp, so it cannot be forged
-- through the browser's limited activity_attempts permissions.
create or replace function public.is_free_answer_unlocked(p_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.learning_activities target
      where target.id = p_activity_id
        and target.type = 'free_answer'
        and target.is_published
        and exists (
          select 1
          from public.learning_activities quiz
          where quiz.module_id = target.module_id
            and quiz.type = 'quiz'
            and quiz.is_published
        )
        and not exists (
          select 1
          from public.learning_activities quiz
          where quiz.module_id = target.module_id
            and quiz.type = 'quiz'
            and quiz.is_published
            and not exists (
              select 1
              from public.activity_attempts attempt
              where attempt.user_id = (select auth.uid())
                and attempt.activity_id = quiz.id
                and attempt.status = 'completed'
                and attempt.score is not null
                and attempt.completed_at is not null
            )
        )
    );
$$;

revoke all on function public.is_free_answer_unlocked(uuid) from public;
grant execute on function public.is_free_answer_unlocked(uuid) to authenticated;

drop policy "Users manage their attempts" on public.activity_attempts;

create policy "Users manage their attempts"
on public.activity_attempts for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.learning_activities activity
    where activity.id = activity_attempts.activity_id
      and (
        activity.type <> 'free_answer'
        or public.is_free_answer_unlocked(activity.id)
      )
  )
);

drop policy "Users manage their free answers" on public.free_answer_submissions;

create policy "Users manage their free answers"
on public.free_answer_submissions for all to authenticated
using (exists (
  select 1
  from public.activity_attempts attempt
  where attempt.id = free_answer_submissions.attempt_id
    and attempt.user_id = (select auth.uid())
    and public.is_free_answer_unlocked(attempt.activity_id)
))
with check (exists (
  select 1
  from public.activity_attempts attempt
  where attempt.id = free_answer_submissions.attempt_id
    and attempt.user_id = (select auth.uid())
    and public.is_free_answer_unlocked(attempt.activity_id)
));

commit;
