-- Run only against the isolated Supabase development database.
-- Synthetic users, attempts, and recommendation records roll back.
-- Execute after 20261125040000_phase5_performance_recommendations.sql is applied.

begin;

do $$
begin
  if has_table_privilege(
    'authenticated',
    'public.exam_performance_recommendations',
    'INSERT'
  )
    or has_table_privilege(
      'authenticated',
      'public.exam_performance_recommendations',
      'UPDATE'
    )
    or has_table_privilege(
      'authenticated',
      'public.exam_performance_recommendations',
      'DELETE'
    )
  then
    raise exception 'Learners can modify persisted recommendations';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'exam_performance_recommendations'
      and c.relrowsecurity
  ) then
    raise exception 'Performance recommendations do not have row-level security enabled';
  end if;
end;
$$;

do $$
declare
  learner_one uuid := '10000000-0000-4000-8000-000000000051';
  learner_two uuid := '10000000-0000-4000-8000-000000000052';
  document_one uuid := '20000000-0000-4000-8000-000000000051';
  document_two uuid := '20000000-0000-4000-8000-000000000052';
  quiz_one uuid := '30000000-0000-4000-8000-000000000051';
  quiz_two uuid := '30000000-0000-4000-8000-000000000052';
  attempt_one uuid := '40000000-0000-4000-8000-000000000051';
  attempt_two uuid := '40000000-0000-4000-8000-000000000052';
begin
  insert into auth.users (id, email, email_confirmed_at)
  values
    (learner_one, 'phase5-learner-one@example.invalid', now()),
    (learner_two, 'phase5-learner-two@example.invalid', now())
  on conflict (id) do update set email_confirmed_at = now();

  insert into public.profiles (
    id, first_name, last_name, email, learner_category, account_status
  )
  values
    (learner_one, 'Phase 5', 'One', 'phase5-learner-one@example.invalid', 'independent', 'active'),
    (learner_two, 'Phase 5', 'Two', 'phase5-learner-two@example.invalid', 'independent', 'active')
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
      repeat('e', 64), learner_one::text || '/' || document_one::text || '.txt',
      'ready', 'ready', 'ready',
      '{"title":"Learner one","subject":"Science","summary":"One source.","topics":[{"name":"Science","subtopics":[],"sourceRefs":["S001"]}],"keyConcepts":[],"definitions":[],"importantFacts":[]}'::jsonb
    ),
    (
      document_two, learner_two, 'two.txt', 'txt', 'text/plain', 20,
      repeat('f', 64), learner_two::text || '/' || document_two::text || '.txt',
      'ready', 'ready', 'ready',
      '{"title":"Learner two","subject":"Science","summary":"Another source.","topics":[{"name":"Science","subtopics":[],"sourceRefs":["S001"]}],"keyConcepts":[],"definitions":[],"importantFacts":[]}'::jsonb
    );

  insert into public.learning_quizzes (
    id, user_id, source_document_id, title, question_count, difficulty,
    duration_minutes, selected_topics, generation_status, questions
  )
  values
    (
      quiz_one, learner_one, document_one, 'Learner one quiz', 1, 'easy', 10,
      array['Science'], 'ready',
      '[{"question":"Which fact is stated in the source material?","options":[{"label":"A","text":"Supported fact"},{"label":"B","text":"Incorrect fact one"},{"label":"C","text":"Incorrect fact two"},{"label":"D","text":"Incorrect fact three"}],"correctAnswer":"A","explanation":"The source material directly supports option A.","difficulty":"easy","topic":"Science","sourceRefs":["S001"]}]'::jsonb
    ),
    (
      quiz_two, learner_two, document_two, 'Learner two quiz', 1, 'easy', 10,
      array['Science'], 'ready',
      '[{"question":"Which fact is stated in the second source material?","options":[{"label":"A","text":"Supported fact"},{"label":"B","text":"Incorrect fact one"},{"label":"C","text":"Incorrect fact two"},{"label":"D","text":"Incorrect fact three"}],"correctAnswer":"A","explanation":"The second source material directly supports option A.","difficulty":"easy","topic":"Science","sourceRefs":["S001"]}]'::jsonb
    );

  insert into public.quiz_attempts (
    id, user_id, quiz_id, question_count, started_at, deadline_at,
    answers, status, submitted_at, submission_reason, total_score,
    correct_count, incorrect_count, unanswered_count, percentage
  )
  values
    (
      attempt_one, learner_one, quiz_one, 1, now() - interval '2 minutes',
      now() + interval '8 minutes', '["A"]'::jsonb, 'submitted',
      now() - interval '1 minute', 'manual', 1, 1, 0, 0, 100
    ),
    (
      attempt_two, learner_two, quiz_two, 1, now() - interval '2 minutes',
      now() + interval '8 minutes', '["B"]'::jsonb, 'submitted',
      now() - interval '1 minute', 'manual', 0, 0, 1, 0, 0
    );

  insert into public.exam_performance_recommendations (
    attempt_id, user_id, generation_status, recommendations
  )
  values
    (
      attempt_one, learner_one, 'ready',
      '[{"title":"Review Science","action":"Revisit the cited source section.","topic":"Science","sourceRefs":["S001"]}]'::jsonb
    ),
    (
      attempt_two, learner_two, 'fallback',
      '[{"title":"Review Science","action":"Revisit the cited source section.","topic":"Science","sourceRefs":["S001"]}]'::jsonb
    );

  perform set_config('phase5.attempt_one', attempt_one::text, true);
  perform set_config('phase5.attempt_two', attempt_two::text, true);
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000051',
  true
);
set local role authenticated;

do $$
declare
  v_rejected boolean := false;
begin
  if (
    select count(*) from public.exam_performance_recommendations
    where attempt_id = current_setting('phase5.attempt_one')::uuid
  ) <> 1 then
    raise exception 'Learner cannot read their own recommendation';
  end if;

  if exists (
    select 1 from public.exam_performance_recommendations
    where attempt_id = current_setting('phase5.attempt_two')::uuid
  ) then
    raise exception 'Learner can read another learner recommendation';
  end if;

  begin
    update public.exam_performance_recommendations
    set recommendations = '[]'::jsonb
    where attempt_id = current_setting('phase5.attempt_one')::uuid;
  exception when insufficient_privilege then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Learner modified a persisted recommendation';
  end if;

  v_rejected := false;
  begin
    delete from public.exam_performance_recommendations
    where attempt_id = current_setting('phase5.attempt_one')::uuid;
  exception when insufficient_privilege then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Learner deleted a persisted recommendation';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000052',
  true
);

do $$
declare
  v_visible integer;
begin
  select count(*) into v_visible
  from public.exam_performance_recommendations
  where attempt_id = current_setting('phase5.attempt_two')::uuid;
  if v_visible <> 1 then
    raise exception 'Learner cannot read their own fallback recommendation';
  end if;

  select count(*) into v_visible
  from public.exam_performance_recommendations
  where attempt_id = current_setting('phase5.attempt_one')::uuid;
  if v_visible <> 0 then
    raise exception 'Second learner can read another learner recommendation';
  end if;
end;
$$;

rollback;
