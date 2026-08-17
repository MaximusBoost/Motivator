begin;

-- MVP follows the ordinary sequential path from Government Resolution No. 1198.
-- Exceptional decisions of an authorized commission are intentionally not automated.
update public.user_qualification_profiles
set target_qualification = case current_qualification
  when 'none' then 'third'::public.qualification_level
  when 'third' then 'second'::public.qualification_level
  when 'second' then 'first'::public.qualification_level
  when 'first' then case
    when service_type = 'contract' then 'master'::public.qualification_level
    else 'first'::public.qualification_level
  end
  when 'master' then 'master'::public.qualification_level
end
where not (
  (current_qualification <> 'none' and target_qualification = current_qualification)
  or target_qualification = case current_qualification
    when 'none' then 'third'::public.qualification_level
    when 'third' then 'second'::public.qualification_level
    when 'second' then 'first'::public.qualification_level
    when 'first' then case
      when service_type = 'contract' then 'master'::public.qualification_level
      else 'first'::public.qualification_level
    end
    when 'master' then 'master'::public.qualification_level
  end
);

alter table public.user_qualification_profiles
  add constraint target_qualification_is_sequential check (
    (current_qualification <> 'none' and target_qualification = current_qualification)
    or (
      target_qualification = case current_qualification
        when 'none' then 'third'::public.qualification_level
        when 'third' then 'second'::public.qualification_level
        when 'second' then 'first'::public.qualification_level
        when 'first' then case
          when service_type = 'contract' then 'master'::public.qualification_level
          else 'first'::public.qualification_level
        end
        when 'master' then 'master'::public.qualification_level
      end
    )
  );

create type public.physical_sex as enum ('male', 'female');
create type public.physical_qualification_level as enum ('third', 'second', 'first', 'highest');
create type public.physical_quality as enum ('strength', 'speed', 'endurance');
create type public.physical_exercise_id as enum ('push_ups', 'pull_ups', 'run_100m', 'run_1km');

create table public.user_physical_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sex public.physical_sex not null,
  birth_date date not null,
  assessment_category smallint not null check (assessment_category between 1 and 3),
  target_level public.physical_qualification_level not null,
  policy_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint physical_birth_date_is_valid check (
    birth_date <= current_date - interval '18 years'
  )
);

create trigger user_physical_profiles_set_updated_at
before update on public.user_physical_profiles
for each row execute function public.set_updated_at();

alter table public.user_practice_results
  add column physical_exercise_id public.physical_exercise_id,
  add column physical_quality public.physical_quality,
  add column points smallint check (points between 0 and 100),
  add column age_group smallint check (age_group between 1 and 9);

alter table public.user_practice_results
  add constraint scored_physical_result_is_complete check (
    category <> 'physical'
    or physical_exercise_id is null
    or (
      physical_quality is not null
      and points is not null
      and age_group is not null
    )
  );

alter table public.user_physical_profiles enable row level security;

create policy "Users manage their physical profile"
on public.user_physical_profiles for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_physical_profiles to authenticated;
grant all on public.user_physical_profiles to service_role;

commit;
