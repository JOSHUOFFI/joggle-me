create table public.learner_xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null
    check (event_type in ('exam_complete', 'strong_score', 'streak', 'badge', 'milestone')),
  amount integer not null check (amount > 0),
  source_key text not null check (length(source_key) between 1 and 160),
  reference_attempt_id uuid references public.quiz_attempts(id) on delete set null,
  reference_document_id uuid references public.learning_documents(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint learner_xp_transactions_user_source_unique unique (user_id, source_key)
);

create index learner_xp_transactions_user_created_idx
  on public.learner_xp_transactions (user_id, created_at desc);
create index learner_xp_transactions_attempt_idx
  on public.learner_xp_transactions (reference_attempt_id)
  where reference_attempt_id is not null;

create table public.learner_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null check (
    badge_key in (
      'first_steps',
      'quiz_champion',
      'consistent_learner',
      'perfect_score',
      'dedicated_learner',
      'knowledge_seeker'
    )
  ),
  reference_attempt_id uuid references public.quiz_attempts(id) on delete set null,
  reference_document_id uuid references public.learning_documents(id) on delete set null,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_key)
);

create index learner_badges_user_awarded_idx
  on public.learner_badges (user_id, awarded_at desc);
create index learner_badges_attempt_idx
  on public.learner_badges (reference_attempt_id)
  where reference_attempt_id is not null;

create table public.learner_activity_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  primary key (user_id, activity_date)
);

alter table public.learner_xp_transactions enable row level security;
alter table public.learner_badges enable row level security;
alter table public.learner_activity_days enable row level security;

create policy "Learners read own XP transactions"
on public.learner_xp_transactions for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_account_active(auth.uid())
  and public.has_role('learner')
);

create policy "Learners read own badges"
on public.learner_badges for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_account_active(auth.uid())
  and public.has_role('learner')
);

create policy "Learners read own activity days"
on public.learner_activity_days for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_account_active(auth.uid())
  and public.has_role('learner')
);

revoke all on public.learner_xp_transactions,
  public.learner_badges,
  public.learner_activity_days
from public, anon, authenticated;
grant select on public.learner_xp_transactions,
  public.learner_badges,
  public.learner_activity_days
to authenticated;
grant all on public.learner_xp_transactions,
  public.learner_badges,
  public.learner_activity_days
to service_role;

create or replace function public._award_learner_xp(
  p_user_id uuid,
  p_event_type text,
  p_source_key text,
  p_amount integer,
  p_awarded_at timestamptz,
  p_reference_attempt_id uuid default null,
  p_reference_document_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  insert into public.learner_xp_transactions (
    user_id,
    event_type,
    amount,
    source_key,
    reference_attempt_id,
    reference_document_id,
    metadata,
    created_at
  )
  values (
    p_user_id,
    p_event_type,
    p_amount,
    p_source_key,
    p_reference_attempt_id,
    p_reference_document_id,
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_awarded_at, clock_timestamp())
  )
  on conflict (user_id, source_key) do nothing;
end;
$$;

create or replace function public._award_learner_badge(
  p_user_id uuid,
  p_badge_key text,
  p_awarded_at timestamptz,
  p_reference_attempt_id uuid default null,
  p_reference_document_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  insert into public.learner_badges (
    user_id,
    badge_key,
    reference_attempt_id,
    reference_document_id,
    awarded_at
  )
  values (
    p_user_id,
    p_badge_key,
    p_reference_attempt_id,
    p_reference_document_id,
    coalesce(p_awarded_at, clock_timestamp())
  )
  on conflict (user_id, badge_key) do nothing;

  if found then
    perform public._award_learner_xp(
      p_user_id,
      'badge',
      'badge:' || p_badge_key,
      50,
      p_awarded_at,
      p_reference_attempt_id,
      p_reference_document_id,
      jsonb_build_object('badge_key', p_badge_key)
    );
  end if;
end;
$$;

create or replace function public._record_learner_badge_xp()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  perform public._award_learner_xp(
    new.user_id,
    'badge',
    'badge:' || new.badge_key,
    50,
    new.awarded_at,
    new.reference_attempt_id,
    new.reference_document_id,
    jsonb_build_object('badge_key', new.badge_key)
  );
  return new;
end;
$$;

create trigger learner_badge_xp_after_insert
after insert on public.learner_badges
for each row execute function public._record_learner_badge_xp();

create or replace function public._record_completed_exam_gamification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_activity_date date := (new.submitted_at at time zone 'UTC')::date;
  v_new_activity_day boolean := false;
  v_exam_count bigint;
  v_completed_days bigint;
  v_awarded_at timestamptz;
  v_rows integer;
begin
  if old.status = 'submitted' or new.status <> 'submitted' then
    return new;
  end if;

  perform 1
  from public.profiles p
  where p.id = new.user_id
    and p.account_status = 'active'
    and p.deleted_at is null
  for update;
  if not found then
    raise exception 'An active learner profile is required for examination rewards';
  end if;

  perform public._award_learner_xp(
    new.user_id,
    'exam_complete',
    'exam:' || new.id::text || ':complete',
    50,
    new.submitted_at,
    new.id,
    null,
    jsonb_build_object('percentage', new.percentage)
  );

  if new.percentage >= 90 then
    perform public._award_learner_xp(
      new.user_id,
      'strong_score',
      'exam:' || new.id::text || ':strong_score',
      25,
      new.submitted_at,
      new.id,
      null,
      jsonb_build_object('percentage', new.percentage)
    );
  end if;

  insert into public.learner_activity_days (user_id, activity_date)
  values (new.user_id, v_activity_date)
  on conflict (user_id, activity_date) do nothing;
  get diagnostics v_rows = row_count;
  v_new_activity_day := v_rows = 1;

  if v_new_activity_day and exists (
    select 1
    from public.learner_activity_days d
    where d.user_id = new.user_id
      and d.activity_date = v_activity_date - 1
  ) then
    perform public._award_learner_xp(
      new.user_id,
      'streak',
      'streak:' || v_activity_date::text,
      10,
      new.submitted_at,
      new.id,
      null,
      jsonb_build_object('activity_date', v_activity_date, 'timezone', 'UTC')
    );
  end if;

  select count(*)
  into v_exam_count
  from public.quiz_attempts a
  where a.user_id = new.user_id
    and a.status = 'submitted';

  select count(*)
  into v_completed_days
  from public.learner_activity_days d
  where d.user_id = new.user_id;

  select min(a.submitted_at)
  into v_awarded_at
  from public.quiz_attempts a
  where a.user_id = new.user_id
    and a.status = 'submitted';
  if v_exam_count >= 1 then
    perform public._award_learner_badge(
      new.user_id, 'first_steps', v_awarded_at, new.id
    );
  end if;

  select min(a.submitted_at)
  into v_awarded_at
  from public.quiz_attempts a
  where a.user_id = new.user_id
    and a.status = 'submitted'
    and a.percentage >= 90;
  if v_awarded_at is not null then
    perform public._award_learner_badge(
      new.user_id, 'quiz_champion', v_awarded_at, new.id
    );
  end if;

  select min(a.submitted_at)
  into v_awarded_at
  from public.quiz_attempts a
  where a.user_id = new.user_id
    and a.status = 'submitted'
    and a.percentage = 100;
  if v_awarded_at is not null then
    perform public._award_learner_badge(
      new.user_id, 'perfect_score', v_awarded_at, new.id
    );
  end if;

  if v_completed_days >= 3 then
    select (d.activity_date::timestamp at time zone 'UTC')
    into v_awarded_at
    from public.learner_activity_days d
    where d.user_id = new.user_id
    order by d.activity_date
    offset 2
    limit 1;
    perform public._award_learner_badge(
      new.user_id, 'consistent_learner', v_awarded_at, new.id
    );
  end if;

  if v_exam_count >= 5 then
    select a.submitted_at
    into v_awarded_at
    from public.quiz_attempts a
    where a.user_id = new.user_id
      and a.status = 'submitted'
    order by a.submitted_at, a.id
    offset 4
    limit 1;
    perform public._award_learner_xp(
      new.user_id,
      'milestone',
      'milestone:five_exams',
      25,
      v_awarded_at,
      new.id,
      null,
      jsonb_build_object('milestone', 'five_exams')
    );
  end if;

  if v_exam_count >= 10 then
    select a.submitted_at
    into v_awarded_at
    from public.quiz_attempts a
    where a.user_id = new.user_id
      and a.status = 'submitted'
    order by a.submitted_at, a.id
    offset 9
    limit 1;
    perform public._award_learner_badge(
      new.user_id, 'dedicated_learner', v_awarded_at, new.id
    );
  end if;

  return new;
end;
$$;

create trigger quiz_attempt_gamification_after_submit
after update of status on public.quiz_attempts
for each row
when (old.status is distinct from new.status and new.status = 'submitted')
execute function public._record_completed_exam_gamification();

create or replace function public._record_analysed_material_gamification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_material_count bigint;
  v_awarded_at timestamptz;
begin
  if new.analysis_status <> 'ready' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.analysis_status = 'ready' then
      return new;
    end if;
  end if;

  perform 1
  from public.profiles p
  where p.id = new.user_id
    and p.account_status = 'active'
    and p.deleted_at is null
  for update;
  if not found then
    raise exception 'An active learner profile is required for material rewards';
  end if;

  select count(*)
  into v_material_count
  from public.learning_documents d
  where d.user_id = new.user_id
    and d.analysis_status = 'ready'
    and d.analysis is not null;

  if v_material_count >= 3 then
    select coalesce(d.analyzed_at, d.updated_at, d.created_at)
    into v_awarded_at
    from public.learning_documents d
    where d.user_id = new.user_id
      and d.analysis_status = 'ready'
      and d.analysis is not null
    order by coalesce(d.analyzed_at, d.updated_at, d.created_at), d.id
    offset 2
    limit 1;

    insert into public.learner_badges (
      user_id,
      badge_key,
      reference_document_id,
      awarded_at
    )
    values (
      new.user_id,
      'knowledge_seeker',
      new.id,
      v_awarded_at
    )
    on conflict (user_id, badge_key) do nothing;
  end if;

  return new;
end;
$$;

create trigger analysed_material_gamification_after_ready
after insert or update of analysis_status on public.learning_documents
for each row execute function public._record_analysed_material_gamification();

revoke all on function public._award_learner_xp(
  uuid, text, text, integer, timestamptz, uuid, uuid, jsonb
) from public, anon, authenticated;
revoke all on function public._award_learner_badge(
  uuid, text, timestamptz, uuid, uuid
) from public, anon, authenticated;
revoke all on function public._record_learner_badge_xp()
  from public, anon, authenticated;
revoke all on function public._record_completed_exam_gamification()
  from public, anon, authenticated;
revoke all on function public._record_analysed_material_gamification()
  from public, anon, authenticated;

insert into public.learner_activity_days (user_id, activity_date)
select distinct
  a.user_id,
  (a.submitted_at at time zone 'UTC')::date
from public.quiz_attempts a
where a.status = 'submitted'
on conflict (user_id, activity_date) do nothing;

insert into public.learner_xp_transactions (
  user_id,
  event_type,
  amount,
  source_key,
  reference_attempt_id,
  metadata,
  created_at
)
select
  a.user_id,
  'exam_complete',
  50,
  'exam:' || a.id::text || ':complete',
  a.id,
  jsonb_build_object('percentage', a.percentage),
  a.submitted_at
from public.quiz_attempts a
where a.status = 'submitted'
on conflict (user_id, source_key) do nothing;

insert into public.learner_xp_transactions (
  user_id,
  event_type,
  amount,
  source_key,
  reference_attempt_id,
  metadata,
  created_at
)
select
  a.user_id,
  'strong_score',
  25,
  'exam:' || a.id::text || ':strong_score',
  a.id,
  jsonb_build_object('percentage', a.percentage),
  a.submitted_at
from public.quiz_attempts a
where a.status = 'submitted'
  and a.percentage >= 90
on conflict (user_id, source_key) do nothing;

insert into public.learner_xp_transactions (
  user_id,
  event_type,
  amount,
  source_key,
  reference_attempt_id,
  metadata,
  created_at
)
select
  d.user_id,
  'streak',
  10,
  'streak:' || d.activity_date::text,
  (
    select a.id
    from public.quiz_attempts a
    where a.user_id = d.user_id
      and a.status = 'submitted'
      and (a.submitted_at at time zone 'UTC')::date = d.activity_date
    order by a.submitted_at desc, a.id
    limit 1
  ),
  jsonb_build_object('activity_date', d.activity_date, 'timezone', 'UTC'),
  d.activity_date::timestamp at time zone 'UTC'
from public.learner_activity_days d
where exists (
  select 1
  from public.learner_activity_days previous_day
  where previous_day.user_id = d.user_id
    and previous_day.activity_date = d.activity_date - 1
)
on conflict (user_id, source_key) do nothing;

with ranked_attempts as (
  select
    a.user_id,
    a.id,
    a.submitted_at,
    row_number() over (
      partition by a.user_id
      order by a.submitted_at, a.id
    ) as attempt_number
  from public.quiz_attempts a
  where a.status = 'submitted'
)
insert into public.learner_xp_transactions (
  user_id,
  event_type,
  amount,
  source_key,
  reference_attempt_id,
  metadata,
  created_at
)
select
  a.user_id,
  'milestone',
  25,
  'milestone:five_exams',
  a.id,
  jsonb_build_object('milestone', 'five_exams'),
  a.submitted_at
from ranked_attempts a
where a.attempt_number = 5
on conflict (user_id, source_key) do nothing;

insert into public.learner_badges (user_id, badge_key, reference_attempt_id, awarded_at)
select a.user_id, 'first_steps', a.first_attempt_id, a.first_submitted_at
from (
  select
    user_id,
    min(submitted_at) as first_submitted_at,
    (array_agg(id order by submitted_at, id))[1] as first_attempt_id
  from public.quiz_attempts
  where status = 'submitted'
  group by user_id
) a
on conflict (user_id, badge_key) do nothing;

insert into public.learner_badges (user_id, badge_key, reference_attempt_id, awarded_at)
select a.user_id, 'quiz_champion', a.first_strong_attempt, a.first_strong_at
from (
  select user_id, min(submitted_at) as first_strong_at,
    (array_agg(id order by submitted_at, id))[1] as first_strong_attempt
  from public.quiz_attempts
  where status = 'submitted' and percentage >= 90
  group by user_id
) a
on conflict (user_id, badge_key) do nothing;

insert into public.learner_badges (user_id, badge_key, reference_attempt_id, awarded_at)
select a.user_id, 'perfect_score', a.first_perfect_attempt, a.first_perfect_at
from (
  select user_id, min(submitted_at) as first_perfect_at,
    (array_agg(id order by submitted_at, id))[1] as first_perfect_attempt
  from public.quiz_attempts
  where status = 'submitted' and percentage = 100
  group by user_id
) a
on conflict (user_id, badge_key) do nothing;

with ranked_days as (
  select
    d.user_id,
    d.activity_date,
    row_number() over (
      partition by d.user_id
      order by d.activity_date
    ) as day_number
  from public.learner_activity_days d
)
insert into public.learner_badges (user_id, badge_key, awarded_at)
select
  d.user_id,
  'consistent_learner',
  d.activity_date::timestamp at time zone 'UTC'
from ranked_days d
where d.day_number = 3
on conflict (user_id, badge_key) do nothing;

with ranked_attempts as (
  select
    a.user_id,
    a.id,
    a.submitted_at,
    row_number() over (
      partition by a.user_id
      order by a.submitted_at, a.id
    ) as attempt_number
  from public.quiz_attempts a
  where a.status = 'submitted'
)
insert into public.learner_badges (user_id, badge_key, reference_attempt_id, awarded_at)
select a.user_id, 'dedicated_learner', a.id, a.submitted_at
from ranked_attempts a
where a.attempt_number = 10
on conflict (user_id, badge_key) do nothing;

with ranked_materials as (
  select
    d.user_id,
    d.id,
    coalesce(d.analyzed_at, d.updated_at, d.created_at) as analyzed_at,
    row_number() over (
      partition by d.user_id
      order by coalesce(d.analyzed_at, d.updated_at, d.created_at), d.id
    ) as material_number
  from public.learning_documents d
  where d.analysis_status = 'ready'
    and d.analysis is not null
)
insert into public.learner_badges (
  user_id,
  badge_key,
  reference_document_id,
  awarded_at
)
select d.user_id, 'knowledge_seeker', d.id, d.analyzed_at
from ranked_materials d
where d.material_number = 3
on conflict (user_id, badge_key) do nothing;
