-- Run only against an isolated Supabase development database.
-- Synthetic users and quiz records are rolled back at the end.
-- Execute after 20261125020000_phase3_ai_quizzes.sql is applied.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'learning_quizzes'
      and c.relrowsecurity
  ) then
    raise exception 'Learning quizzes table is missing row-level security';
  end if;
  if has_table_privilege('authenticated', 'public.learning_quizzes', 'INSERT')
    or has_table_privilege('authenticated', 'public.learning_quizzes', 'UPDATE')
  then
    raise exception 'Learners can write quiz rows outside the server-side generation workflow';
  end if;
end;
$$;

do $$
declare
  learner_one uuid := '10000000-0000-4000-8000-000000000031';
  learner_two uuid := '10000000-0000-4000-8000-000000000032';
  document_one uuid := '20000000-0000-4000-8000-000000000031';
  document_two uuid := '20000000-0000-4000-8000-000000000032';
begin
  insert into auth.users (id, email, email_confirmed_at)
  values
    (learner_one, 'phase3-learner-one@example.invalid', now()),
    (learner_two, 'phase3-learner-two@example.invalid', now())
  on conflict (id) do update set email_confirmed_at = now();

  insert into public.profiles (
    id, first_name, last_name, email, learner_category, account_status
  )
  values
    (learner_one, 'Phase 3', 'One', 'phase3-learner-one@example.invalid', 'independent', 'active'),
    (learner_two, 'Phase 3', 'Two', 'phase3-learner-two@example.invalid', 'independent', 'active')
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
      repeat('a', 64), learner_one::text || '/' || document_one::text || '.txt',
      'ready', 'ready', 'ready',
      '{"title":"Learner one","subject":"Science","summary":"One source.","topics":[{"name":"Science","subtopics":[],"sourceRefs":["S001"]}],"keyConcepts":[],"definitions":[],"importantFacts":[]}'::jsonb
    ),
    (
      document_two, learner_two, 'two.txt', 'txt', 'text/plain', 20,
      repeat('b', 64), learner_two::text || '/' || document_two::text || '.txt',
      'ready', 'ready', 'ready',
      '{"title":"Learner two","subject":"Science","summary":"Another source.","topics":[{"name":"Science","subtopics":[],"sourceRefs":["S001"]}],"keyConcepts":[],"definitions":[],"importantFacts":[]}'::jsonb
    );

  insert into public.learning_quizzes (
    id, user_id, source_document_id, title, question_count, difficulty,
    duration_minutes, selected_topics, generation_status, questions
  )
  values
    (
      '30000000-0000-4000-8000-000000000031',
      learner_one, document_one, 'Learner one quiz', 1, 'easy', 10,
      array['Science'], 'ready',
      '[{"question":"What does the source explain about science?","options":[{"label":"A","text":"One"},{"label":"B","text":"Two"},{"label":"C","text":"Three"},{"label":"D","text":"Four"}],"correctAnswer":"A","explanation":"The source identifies option A.","difficulty":"easy","topic":"Science","sourceRefs":["S001"]}]'::jsonb
    ),
    (
      '30000000-0000-4000-8000-000000000032',
      learner_two, document_two, 'Learner two quiz', 1, 'easy', 10,
      array['Science'], 'ready',
      '[{"question":"What does the other source explain about science?","options":[{"label":"A","text":"One"},{"label":"B","text":"Two"},{"label":"C","text":"Three"},{"label":"D","text":"Four"}],"correctAnswer":"A","explanation":"The other source identifies option A.","difficulty":"easy","topic":"Science","sourceRefs":["S001"]}]'::jsonb
    );
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000031',
  true
);
set local role authenticated;

do $$
declare
  rejected boolean := false;
begin
  if (
    select count(*) from public.learning_quizzes
    where user_id = '10000000-0000-4000-8000-000000000031'
  ) <> 1 then
    raise exception 'Learner cannot read their own generated quiz';
  end if;
  if exists (
    select 1 from public.learning_quizzes
    where id = '30000000-0000-4000-8000-000000000032'
  ) then
    raise exception 'Learner can read another learner quiz or its answer data';
  end if;
  begin
    insert into public.learning_quizzes (
      user_id, source_document_id, title, question_count, difficulty,
      duration_minutes, selected_topics
    )
    values (
      '10000000-0000-4000-8000-000000000031',
      '20000000-0000-4000-8000-000000000031',
      'Forged quiz', 1, 'easy', 10, array['Science']
    );
  exception when insufficient_privilege then
    rejected := true;
  end;
  if not rejected then
    raise exception 'Learner inserted quiz data outside the server generation workflow';
  end if;

  delete from public.learning_quizzes
  where id = '30000000-0000-4000-8000-000000000032';
  if exists (
    select 1 from public.learning_quizzes
    where id = '30000000-0000-4000-8000-000000000032'
  ) then
    raise exception 'Learner deleted another learner quiz';
  end if;
  delete from public.learning_quizzes
  where id = '30000000-0000-4000-8000-000000000031';
  if exists (
    select 1 from public.learning_quizzes
    where id = '30000000-0000-4000-8000-000000000031'
  ) then
    raise exception 'Learner could not delete their own quiz';
  end if;
end;
$$;

reset role;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000032',
  true
);
set local role authenticated;

do $$
begin
  if (
    select count(*) from public.learning_quizzes
    where user_id = '10000000-0000-4000-8000-000000000032'
  ) <> 1 then
    raise exception 'Second learner cannot read their own generated quiz';
  end if;
  if exists (
    select 1 from public.learning_quizzes
    where user_id = '10000000-0000-4000-8000-000000000031'
  ) then
    raise exception 'Second learner can read another learner quiz';
  end if;
end;
$$;

rollback;
