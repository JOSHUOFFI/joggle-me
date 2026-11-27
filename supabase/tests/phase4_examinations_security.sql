-- Run only against the isolated Supabase development database.
-- Synthetic users, quizzes, attempts, and feature-flag changes roll back.
-- Execute after 20261125030000_phase4_examination_engine.sql is applied.

begin;

do $$
begin
  if has_column_privilege(
    'authenticated',
    'public.learning_quizzes',
    'questions',
    'SELECT'
  ) then
    raise exception 'Learners can read quiz answer keys directly';
  end if;

  if not has_column_privilege(
    'authenticated',
    'public.learning_quizzes',
    'title',
    'SELECT'
  ) then
    raise exception 'Learners cannot read quiz metadata';
  end if;

  if has_table_privilege('authenticated', 'public.quiz_attempts', 'INSERT')
    or has_table_privilege('authenticated', 'public.quiz_attempts', 'UPDATE')
    or has_table_privilege('authenticated', 'public.quiz_attempts', 'DELETE')
  then
    raise exception 'Learners can mutate examination attempts outside the secured RPCs';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'quiz_attempts'
      and c.relrowsecurity
  ) then
    raise exception 'Examination attempts do not have row-level security enabled';
  end if;
end;
$$;

update public.feature_flags
set enabled = true
where key = 'examination_functionality';

do $$
declare
  learner_one uuid := '10000000-0000-4000-8000-000000000041';
  learner_two uuid := '10000000-0000-4000-8000-000000000042';
  document_one uuid := '20000000-0000-4000-8000-000000000041';
  document_two uuid := '20000000-0000-4000-8000-000000000042';
begin
  insert into auth.users (id, email, email_confirmed_at)
  values
    (learner_one, 'phase4-learner-one@example.invalid', now()),
    (learner_two, 'phase4-learner-two@example.invalid', now())
  on conflict (id) do update set email_confirmed_at = now();

  insert into public.profiles (
    id, first_name, last_name, email, learner_category, account_status
  )
  values
    (learner_one, 'Phase 4', 'One', 'phase4-learner-one@example.invalid', 'independent', 'active'),
    (learner_two, 'Phase 4', 'Two', 'phase4-learner-two@example.invalid', 'independent', 'active')
  on conflict (id) do update set account_status = 'active';

  insert into public.user_roles (user_id, role)
  values (learner_one, 'learner'), (learner_two, 'learner')
  on conflict do nothing;

  insert into public.learning_documents (
    id, user_id, original_filename, file_type, mime_type, byte_size,
    content_hash, object_key, status, extraction_status, analysis_status, analysis
  )
  values
    (
      document_one, learner_one, 'one.txt', 'txt', 'text/plain', 20,
      repeat('c', 64), learner_one::text || '/' || document_one::text || '.txt',
      'ready', 'ready', 'ready',
      '{"title":"Learner one","subject":"Science","summary":"One source.","topics":[{"name":"Science","subtopics":[],"sourceRefs":["S001"]}],"keyConcepts":[],"definitions":[],"importantFacts":[]}'::jsonb
    ),
    (
      document_two, learner_two, 'two.txt', 'txt', 'text/plain', 20,
      repeat('d', 64), learner_two::text || '/' || document_two::text || '.txt',
      'ready', 'ready', 'ready',
      '{"title":"Learner two","subject":"Science","summary":"Another source.","topics":[{"name":"Science","subtopics":[],"sourceRefs":["S001"]}],"keyConcepts":[],"definitions":[],"importantFacts":[]}'::jsonb
    );

  insert into public.learning_quizzes (
    id, user_id, source_document_id, title, question_count, difficulty,
    duration_minutes, selected_topics, generation_status, questions
  )
  values
    (
      '30000000-0000-4000-8000-000000000041',
      learner_one, document_one, 'Learner one quiz', 2, 'easy', 1,
      array['Science'], 'ready',
      '[
        {"question":"Which answer matches the first source fact?","options":[{"label":"A","text":"First correct"},{"label":"B","text":"First wrong one"},{"label":"C","text":"First wrong two"},{"label":"D","text":"First wrong three"}],"correctAnswer":"A","explanation":"The first source fact supports option A.","difficulty":"easy","topic":"Science","sourceRefs":["S001"]},
        {"question":"Which answer matches the second source fact?","options":[{"label":"A","text":"Second wrong one"},{"label":"B","text":"Second correct"},{"label":"C","text":"Second wrong two"},{"label":"D","text":"Second wrong three"}],"correctAnswer":"B","explanation":"The second source fact supports option B.","difficulty":"easy","topic":"Science","sourceRefs":["S001"]}
      ]'::jsonb
    ),
    (
      '30000000-0000-4000-8000-000000000042',
      learner_two, document_two, 'Learner two quiz', 2, 'easy', 1,
      array['Science'], 'ready',
      '[
        {"question":"Which answer matches the other first source fact?","options":[{"label":"A","text":"Other first correct"},{"label":"B","text":"Other first wrong one"},{"label":"C","text":"Other first wrong two"},{"label":"D","text":"Other first wrong three"}],"correctAnswer":"A","explanation":"The other first source fact supports option A.","difficulty":"easy","topic":"Science","sourceRefs":["S001"]},
        {"question":"Which answer matches the other second source fact?","options":[{"label":"A","text":"Other second wrong one"},{"label":"B","text":"Other second correct"},{"label":"C","text":"Other second wrong two"},{"label":"D","text":"Other second wrong three"}],"correctAnswer":"B","explanation":"The other second source fact supports option B.","difficulty":"easy","topic":"Science","sourceRefs":["S001"]}
      ]'::jsonb
    );
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000041',
  true
);
set local role authenticated;

do $$
declare
  v_first record;
  v_repeat record;
  v_saved record;
  v_submitted record;
  v_duplicate record;
  v_unchanged record;
  v_restarted record;
  v_expired record;
  v_rejected boolean := false;
begin
  if (
    select count(*) from public.learning_quizzes
    where id = '30000000-0000-4000-8000-000000000041'
  ) <> 1 then
    raise exception 'Learner cannot read their own quiz metadata';
  end if;
  if exists (
    select 1 from public.learning_quizzes
    where id = '30000000-0000-4000-8000-000000000042'
  ) then
    raise exception 'Learner can read another learner quiz';
  end if;

  begin
    perform questions
    from public.learning_quizzes
    where id = '30000000-0000-4000-8000-000000000041';
  exception when insufficient_privilege then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Learner directly read a quiz answer key';
  end if;

  select * into v_first
  from public.start_quiz_attempt('30000000-0000-4000-8000-000000000041');
  select * into v_repeat
  from public.start_quiz_attempt('30000000-0000-4000-8000-000000000041');
  if v_first.attempt_id is distinct from v_repeat.attempt_id
    or v_first.deadline_at is distinct from v_repeat.deadline_at
    or v_first.status <> 'in_progress'
    or jsonb_array_length(v_first.answers) <> 2
  then
    raise exception 'Starting twice did not return the same active server-timed attempt';
  end if;
  perform set_config('phase4.manual_attempt_id', v_first.attempt_id::text, true);

  v_rejected := false;
  begin
    perform * from public.save_quiz_attempt_answers(
      v_first.attempt_id,
      '["Z",null]'::jsonb
    );
  exception when sqlstate '22023' then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Invalid answer labels were accepted';
  end if;

  select * into v_saved
  from public.save_quiz_attempt_answers(
    v_first.attempt_id,
    '["A","D"]'::jsonb
  );
  if v_saved.status <> 'in_progress'
    or v_saved.answers <> '["A","D"]'::jsonb
  then
    raise exception 'Answers were not saved to the active attempt';
  end if;

  select * into v_submitted
  from public.submit_quiz_attempt(v_first.attempt_id);
  if v_submitted.status <> 'submitted'
    or v_submitted.submission_reason <> 'manual'
    or v_submitted.correct_count <> 1
    or v_submitted.incorrect_count <> 1
    or v_submitted.unanswered_count <> 0
    or v_submitted.total_score <> 1
    or v_submitted.percentage <> 50
  then
    raise exception 'Server-side marking returned an incorrect manual result';
  end if;

  select * into v_duplicate
  from public.submit_quiz_attempt(v_first.attempt_id);
  if v_duplicate.submitted_at is distinct from v_submitted.submitted_at
    or v_duplicate.answers is distinct from v_submitted.answers
    or v_duplicate.correct_count is distinct from v_submitted.correct_count
  then
    raise exception 'Duplicate submission changed the stored result';
  end if;

  select * into v_unchanged
  from public.save_quiz_attempt_answers(
    v_first.attempt_id,
    '["B","B"]'::jsonb
  );
  if v_unchanged.answers <> '["A","D"]'::jsonb
    or v_unchanged.correct_count <> 1
  then
    raise exception 'A submitted attempt accepted answer changes';
  end if;

  select * into v_restarted
  from public.start_quiz_attempt('30000000-0000-4000-8000-000000000041');
  if v_restarted.attempt_id = v_first.attempt_id
    or v_restarted.status <> 'in_progress'
  then
    raise exception 'A new attempt could not start after the previous submission';
  end if;
  perform set_config('phase4.timeout_attempt_id', v_restarted.attempt_id::text, true);

  select * into v_saved
  from public.save_quiz_attempt_answers(v_restarted.attempt_id, '[null,"B"]'::jsonb);
  if v_saved.answers <> '[null,"B"]'::jsonb then
    raise exception 'Partial answers were not saved';
  end if;

  if (
    select count(*) from public.quiz_attempts
    where user_id = '10000000-0000-4000-8000-000000000041'
  ) <> 2 then
    raise exception 'Learner cannot read their own attempts';
  end if;
  if exists (
    select 1 from public.quiz_attempts
    where user_id = '10000000-0000-4000-8000-000000000042'
  ) then
    raise exception 'Learner can read another learner attempt';
  end if;
end;
$$;

reset role;
update public.quiz_attempts
set started_at = clock_timestamp() - interval '2 minutes',
    deadline_at = clock_timestamp() - interval '1 second'
where id = current_setting('phase4.timeout_attempt_id')::uuid;

set local role authenticated;
do $$
declare
  v_expired record;
begin
  select * into v_expired
  from public.get_quiz_attempt_state(
    current_setting('phase4.timeout_attempt_id')::uuid
  );
  if v_expired.status <> 'submitted'
    or v_expired.submission_reason <> 'timeout'
    or v_expired.correct_count <> 1
    or v_expired.incorrect_count <> 0
    or v_expired.unanswered_count <> 1
    or v_expired.percentage <> 50
  then
    raise exception 'Expired attempt was not automatically submitted and marked';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000042',
  true
);

do $$
declare
  v_rejected boolean := false;
  v_other record;
begin
  begin
    select * into v_other
    from public.get_quiz_attempt_state(
      current_setting('phase4.manual_attempt_id')::uuid
    );
  exception when insufficient_privilege then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Second learner accessed another learner attempt state';
  end if;

  v_rejected := false;
  begin
    select * into v_other
    from public.start_quiz_attempt('30000000-0000-4000-8000-000000000041');
  exception when insufficient_privilege then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Second learner started an examination for another learner quiz';
  end if;

  select * into v_other
  from public.start_quiz_attempt('30000000-0000-4000-8000-000000000042');
  if v_other.status <> 'in_progress' then
    raise exception 'Second learner could not start their own examination';
  end if;
end;
$$;

rollback;
