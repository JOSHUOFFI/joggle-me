-- Read-only inventory of Supabase-managed Auth schema objects left in place.
-- Run only against development ref ppdqtaxjptktvkmpjghs.
select jsonb_pretty(jsonb_build_object(
  'auth_schema_relations', (select coalesce(jsonb_agg(jsonb_build_object('name','auth.'||c.relname,'kind',case c.relkind when 'r' then 'table' when 'p' then 'partitioned table' when 'v' then 'view' when 'm' then 'materialized view' else c.relkind::text end) order by c.relname),'[]'::jsonb) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relkind in ('r','p','v','m')),
  'auth_schema_functions', (select coalesce(jsonb_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text),'[]'::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='auth'),
  'auth_users_triggers', (select coalesce(jsonb_agg(jsonb_build_object('name',t.tgname,'definition',pg_get_triggerdef(t.oid)) order by t.tgname),'[]'::jsonb) from pg_trigger t where t.tgrelid='auth.users'::regclass and not t.tgisinternal),
  'provider_config_row_counts', jsonb_build_object(
    'custom_oauth_providers', (select count(*) from auth.custom_oauth_providers),
    'saml_providers', (select count(*) from auth.saml_providers),
    'sso_providers', (select count(*) from auth.sso_providers),
    'sso_domains', (select count(*) from auth.sso_domains)
  ),
  'application_auth_references', jsonb_build_object(
    'public_or_private_functions_using_auth_uid', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f' and pg_get_functiondef(p.oid) ilike '%auth.uid%'),
    'public_foreign_keys_to_auth_users', (select count(*) from pg_constraint c where c.contype='f' and c.confrelid='auth.users'::regclass and c.connamespace='public'::regnamespace),
    'public_policies', (select count(*) from pg_policies where schemaname='public'),
    'storage_policies', (select count(*) from pg_policies where schemaname='storage')
  )
));
