-- Integration test for the guest examination-start RPC.
-- Run against a disposable/local database. All fixture inserts and attempts
-- are enclosed in a transaction that is rolled back at the end.
begin;
set local role service_role;

do $$
declare
  v_workspace_a uuid := gen_random_uuid();
  v_workspace_b uuid := gen_random_uuid();
  v_document_a uuid := gen_random_uuid();
  v_document_b uuid := gen_random_uuid();
  v_quiz_a uuid := gen_random_uuid();
  v_quiz_b uuid := gen_random_uuid();
  v_token_a text := repeat('a', 64);
  v_token_b text := repeat('b', 64);
  v_missing_token text := repeat('c', 64);
  v_response jsonb;
  v_second_response jsonb;
  v_questions jsonb;
  v_attempt_id uuid;
  v_attempt_count bigint;
begin
  insert into public.guest_workspaces (id, token_hash)
  values (v_workspace_a, v_token_a), (v_workspace_b, v_token_b);

  insert into public.learning_documents (
    id, user_id, original_filename, file_type, mime_type, byte_size,
    content_hash, object_key, status, extraction_status, analysis_status,
    analysis
  ) values
    (v_document_a, v_workspace_a, 'rpc-test-a.txt', 'txt', 'text/plain', 1,
      repeat('1', 64), v_workspace_a::text || '/rpc-test-a.txt', 'ready', 'ready', 'ready', '{}'::jsonb),
    (v_document_b, v_workspace_b, 'rpc-test-b.txt', 'txt', 'text/plain', 1,
      repeat('2', 64), v_workspace_b::text || '/rpc-test-b.txt', 'ready', 'ready', 'ready', '{}'::jsonb);

  insert into public.learning_quizzes (
    id, user_id, source_document_id, title, question_count, difficulty,
    duration_minutes, selected_topics, questions, generation_status
  ) values
    (v_quiz_a, v_workspace_a, v_document_a, 'RPC integration quiz A', 1, 'easy', 5,
      array['Science'], '[{"question":"Question A?","options":[{"label":"A","text":"Answer"},{"label":"B","text":"Choice B"},{"label":"C","text":"Choice C"},{"label":"D","text":"Choice D"}],"correctAnswer":"A","explanation":"Test explanation.","difficulty":"easy","topic":"Science","sourceRefs":[]}]'::jsonb, 'ready'),
    (v_quiz_b, v_workspace_b, v_document_b, 'RPC integration quiz B', 1, 'easy', 5,
      array['Science'], '[{"question":"Question B?","options":[{"label":"A","text":"Answer"},{"label":"B","text":"Choice B"},{"label":"C","text":"Choice C"},{"label":"D","text":"Choice D"}],"correctAnswer":"A","explanation":"Test explanation.","difficulty":"easy","topic":"Science","sourceRefs":[]}]'::jsonb, 'ready');

  select to_jsonb(started) into v_response
  from public.guest_start_quiz_attempt(v_token_a, v_quiz_a) as started;
  if v_response is null
    or not (v_response ?& array[
      'attempt_id', 'quiz_id', 'question_count', 'started_at', 'deadline_at',
      'answers', 'status', 'submitted_at', 'submission_reason', 'total_score',
      'correct_count', 'incorrect_count', 'unanswered_count', 'percentage', 'server_now'
    ]) then
    raise exception 'Guest start RPC did not return the full attempt state';
  end if;
  if v_response->>'status' <> 'in_progress'
    or (v_response->>'quiz_id')::uuid <> v_quiz_a
    or (v_response->>'question_count')::integer <> 1
    or jsonb_array_length(v_response->'answers') <> 1 then
    raise exception 'Guest start RPC returned inconsistent attempt state';
  end if;

  v_attempt_id := (v_response->>'attempt_id')::uuid;
  select questions into v_questions
  from public.learning_quizzes
  where id = v_quiz_a and user_id = v_workspace_a and generation_status = 'ready';
  if jsonb_array_length(v_questions) <> (v_response->>'question_count')::integer then
    raise exception 'Ready quiz questions do not match the attempt question count';
  end if;

  select to_jsonb(started) into v_second_response
  from public.guest_start_quiz_attempt(v_token_a, v_quiz_a) as started;
  if (v_second_response->>'attempt_id')::uuid <> v_attempt_id then
    raise exception 'Starting an active quiz did not return the existing attempt';
  end if;
  select count(*) into v_attempt_count
  from public.quiz_attempts where quiz_id = v_quiz_a and user_id = v_workspace_a;
  if v_attempt_count <> 1 then
    raise exception 'Starting an active quiz created a duplicate attempt';
  end if;

  begin
    perform * from public.guest_start_quiz_attempt(v_token_a, v_quiz_b);
    raise exception 'Wrong-workspace quiz access unexpectedly succeeded';
  exception when sqlstate '42501' then
    null;
  end;

  begin
    perform * from public.guest_start_quiz_attempt(v_missing_token, v_quiz_a);
    raise exception 'Unknown guest capability unexpectedly succeeded';
  exception when sqlstate '42501' then
    null;
  end;

  begin
    perform * from public.guest_start_quiz_attempt('invalid', v_quiz_a);
    raise exception 'Malformed guest capability unexpectedly succeeded';
  exception when sqlstate '42501' then
    null;
  end;
end;
$$;

rollback;
