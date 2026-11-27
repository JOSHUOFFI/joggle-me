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

  update public.quiz_attempts as attempt
  set answers = p_answers,
      updated_at = clock_timestamp()
  where attempt.id = p_attempt_id
    and attempt.user_id = v_user_id
    and attempt.status = 'in_progress';

  return query
    select * from public._get_quiz_attempt_state(p_attempt_id, v_user_id);
end;
$$;
