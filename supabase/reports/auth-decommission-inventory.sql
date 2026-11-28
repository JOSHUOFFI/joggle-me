-- Read-only preflight for development project ppdqtaxjptktvkmpjghs.
-- This single SELECT exposes counts and object names, never row contents.
with row_counts as (
  select 'auth.users' as table_name, count(*)::bigint as row_count from auth.users
  union all select 'auth.identities', count(*) from auth.identities
  union all select 'auth.sessions', count(*) from auth.sessions
  union all select 'auth.refresh_tokens', count(*) from auth.refresh_tokens
  union all select 'public.profiles', count(*) from public.profiles
  union all select 'public.clerk_identity_links', count(*) from public.clerk_identity_links
  union all select 'public.user_roles', count(*) from public.user_roles
  union all select 'public.user_consents', count(*) from public.user_consents
  union all select 'public.feature_flags', count(*) from public.feature_flags
  union all select 'public.feature_flag_rules', count(*) from public.feature_flag_rules
  union all select 'public.administrative_audit_logs', count(*) from public.administrative_audit_logs
  union all select 'public.learning_documents', count(*) from public.learning_documents
  union all select 'public.document_sections', count(*) from public.document_sections
  union all select 'public.learning_quizzes', count(*) from public.learning_quizzes
  union all select 'public.quiz_attempts', count(*) from public.quiz_attempts
  union all select 'public.exam_performance_recommendations', count(*) from public.exam_performance_recommendations
  union all select 'public.learner_xp_transactions', count(*) from public.learner_xp_transactions
  union all select 'public.learner_badges', count(*) from public.learner_badges
  union all select 'public.learner_activity_days', count(*) from public.learner_activity_days
  union all select 'public.study_groups', count(*) from public.study_groups
  union all select 'public.study_group_members', count(*) from public.study_group_members
  union all select 'public.community_profiles', count(*) from public.community_profiles
  union all select 'public.community_posts', count(*) from public.community_posts
  union all select 'public.community_questions', count(*) from public.community_questions
  union all select 'public.community_answers', count(*) from public.community_answers
  union all select 'public.community_comments', count(*) from public.community_comments
  union all select 'public.community_reactions', count(*) from public.community_reactions
  union all select 'public.community_notifications', count(*) from public.community_notifications
  union all select 'public.community_reports', count(*) from public.community_reports
  union all select 'public.community_blocks', count(*) from public.community_blocks
),
auth_fks as (
  select format('%I.%I.%I -> %I.%I.%I', child_ns.nspname, child.relname, child_col.attname,
    parent_ns.nspname, parent.relname, parent_col.attname) as fk
  from pg_constraint fk
  join pg_class child on child.oid = fk.conrelid
  join pg_namespace child_ns on child_ns.oid = child.relnamespace
  join pg_class parent on parent.oid = fk.confrelid
  join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
  join unnest(fk.conkey) with ordinality child_key(attnum, ord) on true
  join unnest(fk.confkey) with ordinality parent_key(attnum, ord) on parent_key.ord = child_key.ord
  join pg_attribute child_col on child_col.attrelid = child.oid and child_col.attnum = child_key.attnum
  join pg_attribute parent_col on parent_col.attrelid = parent.oid and parent_col.attnum = parent_key.attnum
  where fk.contype = 'f' and parent_ns.nspname = 'auth' and parent.relname = 'users'
),
auth_routines as (
  select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as signature
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prokind = 'f'
    and (pg_get_functiondef(p.oid) ilike '%auth.%' or p.proname ilike '%clerk%'
      or p.proname ilike '%owner%' or p.proname in ('is_account_active', 'get_my_roles',
      'has_role', 'is_platform_owner', 'has_platform_authority', 'provision_initial_owner',
      'owner_change_role', 'owner_set_account_status', 'owner_set_feature_flag'))
)
select jsonb_build_object(
  'row_counts', (select jsonb_object_agg(table_name, row_count) from row_counts),
  'feature_flags', (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'enabled', enabled) order by key), '[]'::jsonb) from public.feature_flags),
  'auth_user_foreign_keys', (select coalesce(jsonb_agg(fk order by fk), '[]'::jsonb) from auth_fks),
  'auth_related_routines', (select coalesce(jsonb_agg(signature order by signature), '[]'::jsonb) from auth_routines),
  'policies', (select coalesce(jsonb_agg(format('%I.%I: %I roles=%s cmd=%s', schemaname, tablename, policyname, roles, cmd)
    order by schemaname, tablename, policyname), '[]'::jsonb) from pg_policies where schemaname in ('public', 'storage')),
  'learning_storage_objects', (select coalesce(jsonb_object_agg(bucket_id, object_count), '{}'::jsonb)
    from (select bucket_id, count(*)::bigint as object_count from storage.objects group by bucket_id) buckets)
) as preflight_inventory;
