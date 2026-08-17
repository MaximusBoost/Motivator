begin;

create type public.content_source_kind as enum (
  'user_document',
  'official_legal',
  'official_guidance',
  'training_manual'
);

create table public.content_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  kind public.content_source_kind not null,
  file_name text,
  uri text,
  version_label text not null,
  published_on date,
  verified_at date,
  is_current_verified boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  constraint content_source_location_required check (
    file_name is not null or uri is not null
  ),
  constraint content_source_title_not_blank check (length(trim(title)) > 0),
  constraint content_source_version_not_blank check (length(trim(version_label)) > 0)
);

create table public.module_content_sources (
  module_id uuid not null references public.modules(id) on delete cascade,
  source_id uuid not null references public.content_sources(id) on delete cascade,
  locator text not null,
  primary key (module_id, source_id),
  constraint module_source_locator_not_blank check (length(trim(locator)) > 0)
);

create table public.free_answer_rubrics (
  activity_id uuid primary key references public.learning_activities(id) on delete cascade,
  reference_answer_points text[] not null,
  constraint free_answer_reference_points_required check (
    cardinality(reference_answer_points) > 0
  )
);

alter table public.evaluation_criteria
  add column guidance text not null default '',
  add column required_concepts text[] not null default '{}';

create index content_sources_subject_id_idx
  on public.content_sources(subject_id);

create index module_content_sources_source_id_idx
  on public.module_content_sources(source_id);

alter table public.content_sources enable row level security;
alter table public.module_content_sources enable row level security;
alter table public.free_answer_rubrics enable row level security;

create policy "Sources of published subjects are readable"
on public.content_sources for select to anon, authenticated
using (exists (
  select 1
  from public.subjects subject
  where subject.id = content_sources.subject_id
    and subject.is_published
));

create policy "Sources of published modules are readable"
on public.module_content_sources for select to anon, authenticated
using (exists (
  select 1
  from public.modules module
  join public.subjects subject on subject.id = module.subject_id
  where module.id = module_content_sources.module_id
    and module.is_published
    and subject.is_published
));

grant select on public.content_sources, public.module_content_sources
  to anon, authenticated;

-- Learners see criterion names and weights, while detailed grading guidance
-- remains server-only and cannot be used as an answer key from the browser.
revoke select on public.evaluation_criteria from anon, authenticated;
grant select (id, activity_id, title, weight_percent, position)
  on public.evaluation_criteria to anon, authenticated;

grant all on public.content_sources, public.module_content_sources
  to service_role;
grant all on public.free_answer_rubrics to service_role;

commit;
