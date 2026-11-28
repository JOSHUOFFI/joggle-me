-- Read-only review of guest workspaces before any test-artifact cleanup.
-- Run only against development ref ppdqtaxjptktvkmpjghs.
select jsonb_pretty(jsonb_build_object(
  'totals', jsonb_build_object(
    'workspaces', (select count(*) from public.guest_workspaces),
    'tokenless_legacy_workspaces', (select count(*) from public.guest_workspaces where token_hash is null),
    'capability_workspaces', (select count(*) from public.guest_workspaces where token_hash is not null),
    'workspaces_with_learning_rows', (select count(*) from public.guest_workspaces w where exists(select 1 from public.learning_documents d where d.user_id=w.id) or exists(select 1 from public.learning_quizzes q where q.user_id=w.id) or exists(select 1 from public.quiz_attempts a where a.user_id=w.id)),
    'tokenless_legacy_workspaces_with_learning_rows', (select count(*) from public.guest_workspaces w where w.token_hash is null and (exists(select 1 from public.learning_documents d where d.user_id=w.id) or exists(select 1 from public.learning_quizzes q where q.user_id=w.id) or exists(select 1 from public.quiz_attempts a where a.user_id=w.id))),
    'capability_workspaces_with_learning_rows', (select count(*) from public.guest_workspaces w where w.token_hash is not null and (exists(select 1 from public.learning_documents d where d.user_id=w.id) or exists(select 1 from public.learning_quizzes q where q.user_id=w.id) or exists(select 1 from public.quiz_attempts a where a.user_id=w.id))),
    'workspaces_with_community_or_gamification_rows', (select count(*) from public.guest_workspaces w where exists(select 1 from public.community_profiles c where c.user_id=w.id) or exists(select 1 from public.community_posts c where c.author_id=w.id) or exists(select 1 from public.community_questions c where c.author_id=w.id) or exists(select 1 from public.learner_xp_transactions x where x.user_id=w.id) or exists(select 1 from public.learner_badges b where b.user_id=w.id))
  ),
  'display_name_counts', (select coalesce(jsonb_object_agg(display_name, n), '{}'::jsonb) from (select display_name,count(*) n from public.guest_workspaces group by display_name) names),
  'capability_creation_hours_utc', (select coalesce(jsonb_object_agg(hour_utc,n order by hour_utc),'{}'::jsonb) from (select to_char(date_trunc('hour',created_at at time zone 'UTC'),'YYYY-MM-DD HH24:00') hour_utc,count(*) n from public.guest_workspaces where token_hash is not null group by 1) hours),
  'learning_data_counts', jsonb_build_object(
    'documents', (select count(*) from public.learning_documents),
    'document_sections', (select count(*) from public.document_sections),
    'quizzes', (select count(*) from public.learning_quizzes),
    'attempts', (select count(*) from public.quiz_attempts),
    'private_storage_objects', (select count(*) from storage.objects where bucket_id='learning-materials')
  )
));
