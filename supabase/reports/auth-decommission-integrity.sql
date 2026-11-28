-- Read-only post-migration integrity check. Run only against development ref
-- ppdqtaxjptktvkmpjghs; this file contains no mutation statements.
select jsonb_pretty(jsonb_build_object(
  'auth_records', jsonb_build_object(
    'users', (select count(*) from auth.users),
    'identities', (select count(*) from auth.identities),
    'sessions', (select count(*) from auth.sessions),
    'refresh_tokens', (select count(*) from auth.refresh_tokens)
  ),
  'application_objects', jsonb_build_object(
    'guest_workspaces', (select count(*) from public.guest_workspaces),
    'profiles_table', to_regclass('public.profiles') is not null,
    'clerk_identity_links_table', to_regclass('public.clerk_identity_links') is not null,
    'user_roles_table', to_regclass('public.user_roles') is not null,
    'user_consents_table', to_regclass('public.user_consents') is not null,
    'administrative_audit_logs_table', to_regclass('public.administrative_audit_logs') is not null,
    'feature_flags_table', to_regclass('public.feature_flags') is not null,
    'public_auth_user_foreign_keys', (select count(*) from pg_constraint c where c.contype='f' and c.confrelid='auth.users'::regclass and c.connamespace='public'::regnamespace),
    'auth_named_public_policies', (select count(*) from pg_policies where schemaname='public'),
    'storage_policies', (select count(*) from pg_policies where schemaname='storage'),
    'functions_referencing_removed_profile_or_role_objects', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f' and (pg_get_functiondef(p.oid) ilike '%public.profiles%' or pg_get_functiondef(p.oid) ilike '%public.user_roles%' or pg_get_functiondef(p.oid) ilike '%public.has_role(%' or pg_get_functiondef(p.oid) ilike '%public.is_account_active(%')),
    'application_functions_referencing_auth_uid', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f' and pg_get_functiondef(p.oid) ilike '%auth.uid%')
    , 'guest_workspace_foreign_keys', (select coalesce(jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'constraint',c.conname,'definition',pg_get_constraintdef(c.oid)) order by c.conrelid::regclass::text,c.conname),'[]'::jsonb) from pg_constraint c where c.contype='f' and c.confrelid='public.guest_workspaces'::regclass)
  ),
  'learning_data', jsonb_build_object(
    'learning_documents', (select count(*) from public.learning_documents),
    'document_sections', (select count(*) from public.document_sections),
    'learning_quizzes', (select count(*) from public.learning_quizzes),
    'quiz_attempts', (select count(*) from public.quiz_attempts),
    'documents_without_workspace', (select count(*) from public.learning_documents d left join public.guest_workspaces w on w.id=d.user_id where w.id is null),
    'sections_without_matching_document', (select count(*) from public.document_sections s left join public.learning_documents d on d.id=s.document_id and d.user_id=s.user_id where d.id is null),
    'quizzes_without_workspace', (select count(*) from public.learning_quizzes q left join public.guest_workspaces w on w.id=q.user_id where w.id is null),
    'attempts_without_workspace', (select count(*) from public.quiz_attempts a left join public.guest_workspaces w on w.id=a.user_id where w.id is null),
    'private_learning_material_objects', (select count(*) from storage.objects where bucket_id='learning-materials'),
    'learning_material_bucket_public', (select public from storage.buckets where id='learning-materials')
  ),
  'guest_functions', jsonb_build_object(
    'resolve_guest_workspace', to_regprocedure('public.resolve_guest_workspace(text)') is not null,
    'create_document', to_regprocedure('public.guest_create_learning_document(text,uuid,text,text,text,bigint,text)') is not null,
    'retry_document', to_regprocedure('public.guest_retry_learning_document(text,uuid)') is not null,
    'start_exam', to_regprocedure('public.guest_start_quiz_attempt(text,uuid)') is not null,
    'submit_exam', to_regprocedure('public.guest_submit_quiz_attempt(text,uuid)') is not null
  )
));
