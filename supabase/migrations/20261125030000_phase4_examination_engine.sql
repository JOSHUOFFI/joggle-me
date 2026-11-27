alter table public.learning_quizzes
  add constraint learning_quizzes_id_user_unique unique (id, user_id);

revoke select on public.learning_quizzes from authenticated;
grant select (
  id,
  user_id,
  source_document_id,
  title,
  question_count,
  difficulty,
  duration_minutes,
  selected_topics,
  generation_status,
  created_at,
  updated_at
) on public.learning_quizzes to authenticated;

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quiz_id uuid not null,
  question_count integer not null check (question_count between 1 and 30),
  started_at timestamptz not null,
  deadline_at timestamptz not null,
  answers jsonb not null check (jsonb_typeof(answers) = 'array'),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'submitted')),
  submitted_at timestamptz,
  submission_reason text check (submission_reason in ('manual', 'timeout')),
  total_score integer,
  correct_count integer,
  incorrect_count integer,
  unanswered_count integer,
  percentage numeric(5, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quiz_attempts_quiz_owner_fkey
    foreign key (quiz_id, user_id)
    references public.learning_quizzes(id, user_id)
    on delete cascade,
  constraint quiz_attempts_deadline_check check (deadline_at > started_at),
  constraint quiz_attempts_answer_count_check
    check (jsonb_array_length(answers) = question_count),
  constraint quiz_attempts_result_state_check check (
    (
      status = 'in_progress'
      and submitted_at is null
      and submission_reason is null
      and total_score is null
      and correct_count is null
      and incorrect_count is null
      and unanswered_count is null
      and percentage is null
    )
    or (
      status = 'submitted'
      and submitted_at is not null
      and submission_reason is not null
      and total_score = correct_count
      and correct_count >= 0
      and incorrect_count >= 0
      and unanswered_count >= 0
      and correct_count + incorrect_count + unanswered_count = question_count
      and percentage between 0 and 100
    )
  )
);

create unique index quiz_attempts_one_active_per_quiz_idx
  on public.quiz_attempts (user_id, quiz_id)
  where status = 'in_progress';
create index quiz_attempts_user_created_idx
  on public.quiz_attempts (user_id, created_at desc);

alter table public.quiz_attempts enable row level security;

create policy "Learners read own quiz attempts"
on public.quiz_attempts for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_account_active(auth.uid())
  and public.has_role('learner')
);

revoke all on public.quiz_attempts from public, anon, authenticated;
grant select on public.quiz_attempts to authenticated;
grant all on public.quiz_attempts to service_role;

create or replace function public._finalize_quiz_attempt(
  p_attempt_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_attempt public.quiz_attempts%rowtype;
  v_questions jsonb;
  v_correct integer;
  v_unanswered integer;
  v_incorrect integer;
  v_now timestamptz := clock_timestamp();
begin
  select a.*
  into v_attempt
  from public.quiz_attempts a
  where a.id = p_attempt_id
    and a.user_id = p_user_id
  for update;

  if not found or v_attempt.status = 'submitted' then
    return;
  end if;

  select q.questions
  into v_questions
  from public.learning_quizzes q
  where q.id = v_attempt.quiz_id
    and q.user_id = p_user_id
    and q.generation_status = 'ready';

  if v_questions is null
    or jsonb_typeof(v_questions) <> 'array'
    or jsonb_array_length(v_questions) <> v_attempt.question_count
  then
    raise exception 'The quiz answer key is unavailable';
  end if;

  select
    count(*) filter (
      where a.answer #>> '{}' = q.question ->> 'correctAnswer'
    )::integer,
    count(*) filter (where a.answer = 'null'::jsonb)::integer
  into v_correct, v_unanswered
  from jsonb_array_elements(v_attempt.answers) with ordinality a(answer, position)
  join jsonb_array_elements(v_questions) with ordinality q(question, position)
    using (position);

  v_incorrect := v_attempt.question_count - v_correct - v_unanswered;

  update public.quiz_attempts
  set status = 'submitted',
      submitted_at = v_now,
      submission_reason = case
        when v_now >= v_attempt.deadline_at then 'timeout'
        else 'manual'
      end,
      total_score = v_correct,
      correct_count = v_correct,
      incorrect_count = v_incorrect,
      unanswered_count = v_unanswered,
      percentage = round(v_correct * 100.0 / v_attempt.question_count, 2),
      updated_at = v_now
  where id = v_attempt.id
    and user_id = p_user_id
    and status = 'in_progress';
end;
$$;

create or replace function public._get_quiz_attempt_state(
  p_attempt_id uuid,
  p_user_id uuid
)
returns table (
  attempt_id uuid,
  quiz_id uuid,
  question_count integer,
  started_at timestamptz,
  deadline_at timestamptz,
  answers jsonb,
  status text,
  submitted_at timestamptz,
  submission_reason text,
  total_score integer,
  correct_count integer,
  incorrect_count integer,
  unanswered_count integer,
  percentage numeric,
  server_now timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_attempt public.quiz_attempts%rowtype;
begin
  if p_user_id is null
    or not public.is_account_active(p_user_id)
    or not public.has_role('learner')
  then
    raise exception 'An active learner account is required'
      using errcode = '42501';
  end if;

  select a.*
  into v_attempt
  from public.quiz_attempts a
  where a.id = p_attempt_id
    and a.user_id = p_user_id
  for update;

  if not found then
    raise exception 'Quiz attempt was not found'
      using errcode = '42501';
  end if;

  if v_attempt.status = 'in_progress'
    and clock_timestamp() >= v_attempt.deadline_at
  then
    perform public._finalize_quiz_attempt(p_attempt_id, p_user_id);
  end if;

  return query
  select
    a.id,
    a.quiz_id,
    a.question_count,
    a.started_at,
    a.deadline_at,
    a.answers,
    a.status,
    a.submitted_at,
    a.submission_reason,
    a.total_score,
    a.correct_count,
    a.incorrect_count,
    a.unanswered_count,
    a.percentage,
    clock_timestamp()
  from public.quiz_attempts a
  where a.id = p_attempt_id
    and a.user_id = p_user_id;
end;
$$;

create or replace function public.start_quiz_attempt(p_quiz_id uuid)
returns table (
  attempt_id uuid,
  quiz_id uuid,
  question_count integer,
  started_at timestamptz,
  deadline_at timestamptz,
  answers jsonb,
  status text,
  submitted_at timestamptz,
  submission_reason text,
  total_score integer,
  correct_count integer,
  incorrect_count integer,
  unanswered_count integer,
  percentage numeric,
  server_now timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_question_count integer;
  v_duration integer;
  v_attempt_id uuid;
  v_deadline timestamptz;
  v_started_at timestamptz;
  v_now timestamptz;
begin
  if v_user_id is null
    or not public.is_account_active(v_user_id)
    or not public.has_role('learner')
  then
    raise exception 'An active learner account is required'
      using errcode = '42501';
  end if;

  select q.question_count, q.duration_minutes
  into v_question_count, v_duration
  from public.learning_quizzes q
  where q.id = p_quiz_id
    and q.user_id = v_user_id
    and q.generation_status = 'ready'
  for update;

  if not found then
    raise exception 'A ready quiz owned by the learner is required'
      using errcode = '42501';
  end if;

  select a.id, a.deadline_at
  into v_attempt_id, v_deadline
  from public.quiz_attempts a
  where a.quiz_id = p_quiz_id
    and a.user_id = v_user_id
    and a.status = 'in_progress'
  for update;

  if found then
    if clock_timestamp() >= v_deadline then
      perform public._finalize_quiz_attempt(v_attempt_id, v_user_id);
    end if;
    return query
      select * from public._get_quiz_attempt_state(v_attempt_id, v_user_id);
    return;
  end if;

  if not public.is_feature_enabled('examination_functionality') then
    raise exception 'Examination functionality is unavailable'
      using errcode = '55000';
  end if;

  v_now := clock_timestamp();
  v_started_at := v_now;
  v_deadline := v_now + make_interval(mins => v_duration);

  insert into public.quiz_attempts (
    user_id,
    quiz_id,
    question_count,
    started_at,
    deadline_at,
    answers
  )
  values (
    v_user_id,
    p_quiz_id,
    v_question_count,
    v_started_at,
    v_deadline,
    (
      select jsonb_agg('null'::jsonb order by n)
      from generate_series(1, v_question_count) as n
    )
  )
  returning id into v_attempt_id;

  return query
    select * from public._get_quiz_attempt_state(v_attempt_id, v_user_id);
end;
$$;

create or replace function public.get_quiz_attempt_state(p_attempt_id uuid)
returns table (
  attempt_id uuid,
  quiz_id uuid,
  question_count integer,
  started_at timestamptz,
  deadline_at timestamptz,
  answers jsonb,
  status text,
  submitted_at timestamptz,
  submission_reason text,
  total_score integer,
  correct_count integer,
  incorrect_count integer,
  unanswered_count integer,
  percentage numeric,
  server_now timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  return query
    select * from public._get_quiz_attempt_state(p_attempt_id, auth.uid());
end;
$$;

create or replace function public.save_quiz_attempt_answers(
  p_attempt_id uuid,
  p_answers jsonb
)
returns table (
  attempt_id uuid,
  quiz_id uuid,
  question_count integer,
  started_at timestamptz,
  deadline_at timestamptz,
  answers jsonb,
  status text,
  submitted_at timestamptz,
  submission_reason text,
  total_score integer,
  correct_count integer,
  incorrect_count integer,
  unanswered_count integer,
  percentage numeric,
  server_now timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt public.quiz_attempts%rowtype;
begin
  if v_user_id is null
    or not public.is_account_active(v_user_id)
    or not public.has_role('learner')
  then
    raise exception 'An active learner account is required'
      using errcode = '42501';
  end if;

  select a.*
  into v_attempt
  from public.quiz_attempts a
  where a.id = p_attempt_id
    and a.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Quiz attempt was not found'
      using errcode = '42501';
  end if;

  if v_attempt.status = 'submitted' then
    return query
      select * from public._get_quiz_attempt_state(p_attempt_id, v_user_id);
    return;
  end if;

  if clock_timestamp() >= v_attempt.deadline_at then
    perform public._finalize_quiz_attempt(p_attempt_id, v_user_id);
    return query
      select * from public._get_quiz_attempt_state(p_attempt_id, v_user_id);
    return;
  end if;

  if p_answers is null
    or jsonb_typeof(p_answers) <> 'array'
    or jsonb_array_length(p_answers) <> v_attempt.question_count
    or exists (
      select 1
      from jsonb_array_elements(p_answers) as answer(value)
      where jsonb_typeof(answer.value) <> 'null'
        and (
          jsonb_typeof(answer.value) <> 'string'
          or answer.value #>> '{}' not in ('A', 'B', 'C', 'D')
        )
    )
  then
    raise exception 'The answer list is invalid'
      using errcode = '22023';
  end if;

  update public.quiz_attempts
  set answers = p_answers,
      updated_at = clock_timestamp()
  where id = p_attempt_id
    and user_id = v_user_id
    and status = 'in_progress';

  return query
    select * from public._get_quiz_attempt_state(p_attempt_id, v_user_id);
end;
$$;

create or replace function public.submit_quiz_attempt(p_attempt_id uuid)
returns table (
  attempt_id uuid,
  quiz_id uuid,
  question_count integer,
  started_at timestamptz,
  deadline_at timestamptz,
  answers jsonb,
  status text,
  submitted_at timestamptz,
  submission_reason text,
  total_score integer,
  correct_count integer,
  incorrect_count integer,
  unanswered_count integer,
  percentage numeric,
  server_now timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null
    or not public.is_account_active(v_user_id)
    or not public.has_role('learner')
  then
    raise exception 'An active learner account is required'
      using errcode = '42501';
  end if;

  perform public._finalize_quiz_attempt(p_attempt_id, v_user_id);
  return query
    select * from public._get_quiz_attempt_state(p_attempt_id, v_user_id);
end;
$$;

revoke all on function public._finalize_quiz_attempt(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public._get_quiz_attempt_state(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.start_quiz_attempt(uuid)
  from public, anon, authenticated;
revoke all on function public.get_quiz_attempt_state(uuid)
  from public, anon, authenticated;
revoke all on function public.save_quiz_attempt_answers(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.submit_quiz_attempt(uuid)
  from public, anon, authenticated;

grant execute on function public.start_quiz_attempt(uuid) to authenticated;
grant execute on function public.get_quiz_attempt_state(uuid) to authenticated;
grant execute on function public.save_quiz_attempt_answers(uuid, jsonb) to authenticated;
grant execute on function public.submit_quiz_attempt(uuid) to authenticated;
