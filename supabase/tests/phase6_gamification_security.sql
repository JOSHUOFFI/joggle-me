-- Run only against the isolated Supabase development database.
-- Synthetic users and all generated rewards roll back with this transaction.
-- Execute after 20261125050000_phase6_gamification.sql is applied.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'learner_xp_transactions'
      and c.relrowsecurity
  ) or not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'learner_badges'
      and c.relrowsecurity
  ) or not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'learner_activity_days'
      and c.relrowsecurity
  ) then
    raise exception 'Gamification tables must enforce row-level security';
  end if;

  if has_table_privilege(
    'authenticated', 'public.learner_xp_transactions', 'INSERT'
  ) or has_table_privilege(
    'authenticated', 'public.learner_xp_transactions', 'UPDATE'
  ) or has_table_privilege(
    'authenticated', 'public.learner_badges', 'INSERT'
  ) or has_table_privilege(
    'authenticated', 'public.learner_activity_days', 'INSERT'
  ) then
    raise exception 'Learners must not be able to write gamification awards';
  end if;
end;
$$;

do $$
declare
  learner_one uuid := '10000000-0000-4000-8000-000000000061';
  learner_two uuid := '10000000-0000-4000-8000-000000000062';
  document_one uuid := '20000000-0000-4000-8000-000000000061';
  document_two uuid := '20000000-0000-4000-8000-000000000062';
  document_three uuid := '20000000-0000-4000-8000-000000000063';
  document_four uuid := '20000000-0000-4000-8000-000000000064';
  quiz_one uuid := '30000000-0000-4000-8000-000000000061';
  quiz_two uuid := '30000000-0000-4000-8000-000000000062';
  attempt_id uuid;
  attempt_ids uuid[] := array[]::uuid[];
  submitted_time timestamptz;
  score integer;
  row_count_before bigint;
  row_count_after bigint;
  index integer;
begin
  insert into auth.users (id, email, email_confirmed_at)
  values
    (learner_one, 'phase6-learner-one@example.invalid', now()),
    (learner_two, 'phase6-learner-two@example.invalid', now());

  insert into public.profiles (
    id, first_name, last_name, email, learner_category, account_status
  )
  values
    (learner_one, 'Phase 6', 'One', 'phase6-learner-one@example.invalid', 'independent', 'active'),
    (learner_two, 'Phase 6', 'Two', 'phase6-learner-two@example.invalid', 'independent', 'active')
  on conflict (id) do update
  set account_status = excluded.account_status,
      deleted_at = null;

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
      repeat('1', 64), learner_one::text || '/' || document_one::text || '.txt',
      'ready', 'ready', 'ready',
      '{"title":"One","subject":"Science","summary":"One source.","topics":[],"keyConcepts":[],"definitions":[],"importantFacts":[]}'::jsonb
    ),
    (
      document_two, learner_one, 'two.txt', 'txt', 'text/plain', 20,
      repeat('2', 64), learner_one::text || '/' || document_two::text || '.txt',
      'ready', 'ready', 'ready',
      '{"title":"Two","subject":"Science","summary":"Another source.","topics":[],"keyConcepts":[],"definitions":[],"importantFacts":[]}'::jsonb
    ),
    (
      document_three, learner_one, 'three.txt', 'txt', 'text/plain', 20,
      repeat('3', 64), learner_one::text || '/' || document_three::text || '.txt',
      'ready', 'ready', 'ready',
      '{"title":"Three","subject":"Science","summary":"Third source.","topics":[],"keyConcepts":[],"definitions":[],"importantFacts":[]}'::jsonb
    ),
    (
      document_four, learner_two, 'four.txt', 'txt', 'text/plain', 20,
      repeat('4', 64), learner_two::text || '/' || document_four::text || '.txt',
      'ready', 'ready', 'ready',
      '{"title":"Four","subject":"Science","summary":"Learner two source.","topics":[],"keyConcepts":[],"definitions":[],"importantFacts":[]}'::jsonb
    );

  insert into public.learning_quizzes (
    id, user_id, source_document_id, title, question_count, difficulty,
    duration_minutes, selected_topics, generation_status, questions
  )
  values
    (
      quiz_one, learner_one, document_one, 'Phase 6 test quiz', 1, 'easy', 10,
      array['Science'], 'ready',
      '[{"question":"Which fact is in the source?","options":[{"label":"A","text":"Supported"},{"label":"B","text":"Incorrect one"},{"label":"C","text":"Incorrect two"},{"label":"D","text":"Incorrect three"}],"correctAnswer":"A","explanation":"The source states this fact.","difficulty":"easy","topic":"Science","sourceRefs":[]}]'::jsonb
    ),
    (
      quiz_two, learner_two, document_four, 'Phase 6 second learner quiz', 1, 'easy', 10,
      array['Science'], 'ready',
      '[{"question":"Which fact is in the second source?","options":[{"label":"A","text":"Supported"},{"label":"B","text":"Incorrect one"},{"label":"C","text":"Incorrect two"},{"label":"D","text":"Incorrect three"}],"correctAnswer":"A","explanation":"The source states this fact.","difficulty":"easy","topic":"Science","sourceRefs":[]}]'::jsonb
    );

  for index in 1..5 loop
    attempt_id := (
      '40000000-0000-4000-8000-' || lpad(index::text, 12, '0')
    )::uuid;
    submitted_time := case
      when index <= 2 then '2026-04-01 10:00:00+00'::timestamptz + (index - 1) * interval '1 hour'
      when index = 3 then '2026-04-02 10:00:00+00'::timestamptz
      else '2026-04-03 10:00:00+00'::timestamptz + (index - 4) * interval '1 hour'
    end;
    score := case when index = 1 then 1 else 0 end;

    insert into public.quiz_attempts (
      id, user_id, quiz_id, question_count, started_at, deadline_at,
      answers, status
    )
    values (
      attempt_id, learner_one, quiz_one, 1,
      submitted_time - interval '10 minutes',
      submitted_time + interval '10 minutes',
      '["A"]'::jsonb, 'in_progress'
    );

    update public.quiz_attempts
    set status = 'submitted',
        submitted_at = submitted_time,
        submission_reason = 'manual',
        total_score = score,
        correct_count = score,
        incorrect_count = 1 - score,
        unanswered_count = 0,
        percentage = score * 100
    where id = attempt_id;
    attempt_ids := array_append(attempt_ids, attempt_id);
  end loop;

  insert into public.quiz_attempts (
    id, user_id, quiz_id, question_count, started_at, deadline_at,
    answers, status
  )
  values (
    '40000000-0000-4000-8000-000000000006',
    learner_two, quiz_two, 1,
    '2026-05-01 09:50:00+00', '2026-05-01 10:10:00+00',
    '["A"]'::jsonb, 'in_progress'
  );
  update public.quiz_attempts
  set status = 'submitted',
      submitted_at = '2026-05-01 10:00:00+00',
      submission_reason = 'manual',
      total_score = 0,
      correct_count = 0,
      incorrect_count = 1,
      unanswered_count = 0,
      percentage = 0
  where id = '40000000-0000-4000-8000-000000000006';

  if (select count(*) from public.learner_xp_transactions
      where user_id = learner_one) <> 14
    or (select sum(amount) from public.learner_xp_transactions
        where user_id = learner_one) <> 570
    or (select count(*) from public.learner_badges
        where user_id = learner_one) <> 5
    or (select count(*) from public.learner_activity_days
        where user_id = learner_one) <> 3
    or (select count(*) from public.learner_xp_transactions
        where user_id = learner_one and event_type = 'streak') <> 2
  then
    raise exception 'Exam, streak, badge, material, or milestone rewards were incorrect';
  end if;

  select count(*) into row_count_before
  from public.learner_xp_transactions
  where user_id = learner_one;
  update public.quiz_attempts
  set status = 'submitted'
  where id = attempt_ids[5];
  select count(*) into row_count_after
  from public.learner_xp_transactions
  where user_id = learner_one;
  if row_count_before <> row_count_after then
    raise exception 'Repeated finalized-attempt updates duplicated XP awards';
  end if;

  if not has_table_privilege(
    'authenticated', 'public.learner_xp_transactions', 'SELECT'
  ) or not has_table_privilege(
    'authenticated', 'public.learner_badges', 'SELECT'
  ) or not has_table_privilege(
    'authenticated', 'public.learner_activity_days', 'SELECT'
  ) then
    raise exception 'Learners must be able to read their own gamification data';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000061',
  true
);
set local role authenticated;

do $$
declare
  own_xp_count integer;
  other_xp_count integer;
  own_badge_count integer;
  other_badge_count integer;
  write_rejected boolean := false;
begin
  select count(*) into own_xp_count from public.learner_xp_transactions;
  select count(*) into other_xp_count
  from public.learner_xp_transactions
  where user_id = '10000000-0000-4000-8000-000000000062';
  select count(*) into own_badge_count from public.learner_badges;
  select count(*) into other_badge_count
  from public.learner_badges
  where user_id = '10000000-0000-4000-8000-000000000062';

  if own_xp_count <> 14 or other_xp_count <> 0
    or own_badge_count <> 5 or other_badge_count <> 0 then
    raise exception 'Learner gamification read isolation failed';
  end if;

  begin
    insert into public.learner_xp_transactions (
      user_id, event_type, amount, source_key
    )
    values (
      '10000000-0000-4000-8000-000000000061',
      'exam_complete', 999, 'unauthorized:phase6'
    );
  exception when insufficient_privilege then
    write_rejected := true;
  end;
  if not write_rejected then
    raise exception 'Learner directly inserted an XP award';
  end if;
end;
$$;

reset role;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000062',
  true
);
set local role authenticated;

do $$
declare
  own_xp_count integer;
  other_xp_count integer;
  own_badge_count integer;
begin
  select count(*) into own_xp_count from public.learner_xp_transactions;
  select count(*) into other_xp_count
  from public.learner_xp_transactions
  where user_id = '10000000-0000-4000-8000-000000000061';
  select count(*) into own_badge_count from public.learner_badges;

  if own_xp_count <> 2 or other_xp_count <> 0 or own_badge_count <> 1 then
    raise exception 'Second learner gamification isolation failed';
  end if;
end;
$$;

rollback;
