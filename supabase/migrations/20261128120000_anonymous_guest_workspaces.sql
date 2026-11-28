-- Retire application accounts and move owned learning rows to guest workspaces.

create table public.guest_workspaces (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique check (token_hash is null or token_hash ~ '^[0-9a-f]{64}$'),
  display_name text not null default 'Learner' check (length(trim(display_name)) between 1 and 40),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days')
);
alter table public.guest_workspaces enable row level security;
revoke all on public.guest_workspaces from public, anon, authenticated;
grant all on public.guest_workspaces to service_role;

-- Policies can reference auth-specific columns scheduled for removal below.
do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies where schemaname in ('public','storage')
  loop
    execute format('drop policy if exists %I on %I.%I',p.policyname,p.schemaname,p.tablename);
  end loop;
end; $$;

-- Retain old owner UUIDs for referential integrity, without retaining account
-- identity data. Rows created here have no guest token and cannot be claimed.
do $$
begin
  if exists (select 1 from auth.users u left join public.profiles p on p.id=u.id where p.id is null)
    or exists (select 1 from public.profiles p left join auth.users u on u.id=p.id where u.id is null) then
    raise exception 'Guest migration stopped: auth.users and profiles do not map one-to-one';
  end if;
end;
$$;
insert into public.guest_workspaces (id, created_at, last_seen_at, expires_at)
select id, created_at, now(), now() + interval '90 days' from public.profiles;

-- Retarget every surviving public FK to the new workspace identity.
do $$
declare f record; d text;
begin
  for f in
    select c.conrelid::regclass rel, c.conname, pg_get_constraintdef(c.oid) def
    from pg_constraint c join pg_class r on r.oid=c.conrelid
    join pg_namespace n on n.oid=r.relnamespace
    where c.contype='f' and c.confrelid='auth.users'::regclass and n.nspname='public'
      and r.relname not in ('profiles','user_roles','user_consents','feature_flags','administrative_audit_logs')
  loop
    execute format('alter table %s drop constraint %I', f.rel, f.conname);
    d := replace(f.def, 'REFERENCES auth.users', 'REFERENCES public.guest_workspaces');
    if d=f.def then raise exception 'Could not retarget FK %.%', f.rel, f.conname; end if;
    execute format('alter table %s add constraint %I %s', f.rel, f.conname, d);
  end loop;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists profiles_updated_at on public.profiles;
alter table public.community_reports drop column if exists reviewed_by;

-- Replace mutable account flags with the inventoried development defaults.
create or replace function public.is_feature_enabled(p_key text)
returns boolean language sql stable security definer
set search_path = pg_catalog, pg_temp
as $$ select case p_key
  when 'ai_document_analysis' then true
  when 'ai_quiz_generation' then true
  when 'examination_functionality' then true
  when 'learning_material_uploads' then true
  when 'community_enabled' then false
  when 'community_notifications_enabled' then false
  when 'community_posts_enabled' then false
  when 'community_questions_enabled' then false
  when 'study_groups_enabled' then false
  when 'gamification' then false
  when 'social_learning' then false
  else false end; $$;

create or replace function public.is_guest_workspace_active(p_id uuid default auth.uid())
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp
as $$ select exists(select 1 from public.guest_workspaces w where w.id=p_id and w.expires_at>now()); $$;

-- Preserve learner routines while replacing account checks with workspace checks.
do $$
declare f record; d text;
begin
  for f in select p.oid, p.oid::regprocedure::text sig from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'
    and p.proname not in ('is_account_active','has_role')
    and (pg_get_functiondef(p.oid) ilike '%is_account_active%' or pg_get_functiondef(p.oid) ilike '%has_role%')
  loop
    d := pg_get_functiondef(f.oid);
    d := replace(d, 'public.is_account_active(', 'public.is_guest_workspace_active(');
    d := replace(d, 'is_account_active(', 'is_guest_workspace_active(');
    d := replace(d, 'public.has_role(''learner'')', 'public.is_guest_workspace_active(auth.uid())');
    d := replace(d, 'has_role(''learner'')', 'is_guest_workspace_active(auth.uid())');
    execute d;
  end loop;
end;
$$;

create or replace function public.community_can_participate()
returns boolean language sql stable security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$ select public.is_guest_workspace_active(auth.uid())
  and public.is_feature_enabled('community_enabled')
  and not exists(select 1 from public.community_profiles cp where cp.user_id=auth.uid() and cp.community_suspended_until>now()); $$;
create or replace function public.community_is_active_learner(p_user_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp
as $$ select public.is_guest_workspace_active(p_user_id); $$;

-- Gamification triggers use the workspace expiry in place of profile status.
do $$
declare f record; d text;
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and pg_get_functiondef(p.oid) ilike '%public.profiles%'
  loop
    d := pg_get_functiondef(f.oid);
    d := replace(d, 'public.profiles p', 'public.guest_workspaces p');
    d := replace(d, 'p.account_status = ''active''', 'p.expires_at > now()');
    d := replace(d, 'p.deleted_at is null', 'true');
    execute d;
  end loop;
end;
$$;

-- Remove roles, profiles, identity links, auth audit and owner-managed flags.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure::text sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.prokind='f'
      and (p.proname like 'owner\_%' escape '\' or p.proname like 'clerk\_%' escape '\'
        or p.proname in ('is_account_active','get_my_roles','has_role','is_platform_owner','has_platform_authority',
          'handle_new_user','set_profile_updated_at','provision_initial_owner','owner_change_role',
          'owner_set_account_status','owner_set_feature_flag'))
  loop execute format('drop function if exists %s cascade', f.sig); end loop;
end;
$$;
drop table if exists public.clerk_identity_links cascade;
drop table if exists public.user_roles cascade;
drop table if exists public.user_consents cascade;
drop table if exists public.administrative_audit_logs cascade;
drop table if exists public.feature_flag_rules cascade;
drop table if exists public.feature_flags cascade;
drop table if exists public.profiles cascade;
drop type if exists public.app_role cascade;
drop type if exists public.account_status cascade;
drop type if exists public.learner_category cascade;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create or replace function private.set_guest_workspace_context(p_token_hash text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_id uuid;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid guest workspace capability' using errcode='42501'; end if;
  update public.guest_workspaces set last_seen_at=now(), expires_at=now()+interval '90 days'
  where token_hash=p_token_hash and expires_at>now() returning id into v_id;
  if v_id is null then raise exception 'Guest workspace is expired or unavailable' using errcode='42501'; end if;
  perform set_config('request.jwt.claim.sub',v_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_id::text,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  return v_id;
end; $$;
revoke all on function private.set_guest_workspace_context(text) from public, anon, authenticated;
grant execute on function private.set_guest_workspace_context(text) to service_role;

create or replace function public.resolve_guest_workspace(p_token_hash text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$ declare v_id uuid; begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return null; end if;
  update public.guest_workspaces set last_seen_at=now(), expires_at=now()+interval '90 days'
  where token_hash=p_token_hash and expires_at>now() returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.resolve_guest_workspace(text) from public, anon, authenticated;
grant execute on function public.resolve_guest_workspace(text) to service_role;


create or replace function public.enforce_guest_workspace_usage()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_id uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
  v_workspace public.guest_workspaces%rowtype;
  v_count bigint;
begin
  if tg_op = 'UPDATE' and (to_jsonb(old) ->> tg_argv[0]) = v_id::text then
    return new;
  end if;
  select * into v_workspace from public.guest_workspaces
  where id=v_id and expires_at>now() for update;
  if not found then raise exception 'Guest workspace is unavailable' using errcode='42501'; end if;
  if tg_table_name='learning_documents' then
    select count(*) into v_count from public.learning_documents where user_id=v_id and created_at>now()-interval '1 day';
    if v_count>=5 then raise exception 'Daily upload limit reached' using errcode='54000'; end if;
    select count(*) into v_count from public.learning_documents where user_id=v_id;
    if v_count>=20 then raise exception 'Workspace upload limit reached' using errcode='54000'; end if;
  elsif tg_table_name='learning_quizzes' then
    select count(*) into v_count from public.learning_quizzes where user_id=v_id and created_at>now()-interval '1 day';
    if v_count>=20 then raise exception 'Daily quiz limit reached' using errcode='54000'; end if;
    select count(*) into v_count from public.learning_quizzes where user_id=v_id;
    if v_count>=100 then raise exception 'Workspace quiz limit reached' using errcode='54000'; end if;
  elsif tg_table_name='quiz_attempts' then
    select count(*) into v_count from public.quiz_attempts where user_id=v_id and created_at>now()-interval '1 day';
    if v_count>=50 then raise exception 'Daily examination attempt limit reached' using errcode='54000'; end if;
  end if;
  return new;
end; $$;

create trigger guest_document_owner_check before insert or update on public.learning_documents
for each row execute function public.enforce_guest_workspace_usage('user_id');
create trigger guest_quiz_owner_check before insert or update on public.learning_quizzes
for each row execute function public.enforce_guest_workspace_usage('user_id');
create trigger guest_attempt_owner_check before insert or update on public.quiz_attempts
for each row execute function public.enforce_guest_workspace_usage('user_id');

do $$
declare v_row record;
begin
  for v_row in select * from (values
    ('document_sections','user_id'), ('learner_xp_transactions','user_id'), ('learner_badges','user_id'),
    ('learner_activity_days','user_id'), ('study_groups','created_by'), ('study_group_members','user_id'),
    ('community_profiles','user_id'), ('community_posts','author_id'), ('community_questions','author_id'),
    ('community_answers','author_id'), ('community_comments','author_id'), ('community_reactions','user_id'),
    ('community_notifications','recipient_id'), ('community_notifications','actor_id'),
    ('community_reports','reported_by'), ('community_blocks','blocker_id'), ('community_blocks','blocked_id')
  ) as owner(table_name,column_name)
  loop
    execute format('create trigger guest_owner_%I_%I before insert or update on public.%I for each row execute function public.enforce_guest_workspace_usage(%L)',
      v_row.table_name, v_row.column_name, v_row.table_name, v_row.column_name);
  end loop;
end; $$;

create or replace function public.guest_create_learning_document(
  p_token_hash text, p_document_id uuid, p_original_filename text, p_file_type text,
  p_mime_type text, p_byte_size bigint, p_content_hash text
) returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private, auth, pg_temp as $$
begin
  perform private.set_guest_workspace_context(p_token_hash);
  return public.create_learning_document(p_document_id,p_original_filename,p_file_type,p_mime_type,p_byte_size,p_content_hash);
end; $$;

create or replace function public.guest_retry_learning_document(p_token_hash text,p_document_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,private,auth,pg_temp as $$
begin perform private.set_guest_workspace_context(p_token_hash); return public.retry_learning_document(p_document_id); end; $$;
create or replace function public.guest_begin_learning_document_delete(p_token_hash text,p_document_id uuid)
returns text language plpgsql security definer set search_path=pg_catalog,public,private,auth,pg_temp as $$
begin perform private.set_guest_workspace_context(p_token_hash); return public.begin_learning_document_delete(p_document_id); end; $$;
create or replace function public.guest_cancel_learning_document_delete(p_token_hash text,p_document_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public,private,auth,pg_temp as $$
begin perform private.set_guest_workspace_context(p_token_hash); perform public.cancel_learning_document_delete(p_document_id); end; $$;
create or replace function public.guest_finalize_learning_document_delete(p_token_hash text,p_document_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,private,auth,pg_temp as $$
begin perform private.set_guest_workspace_context(p_token_hash); return public.finalize_learning_document_delete(p_document_id); end; $$;
create or replace function public.guest_start_quiz_attempt(p_token_hash text,p_quiz_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,private,auth,pg_temp as $$
begin perform private.set_guest_workspace_context(p_token_hash); return public.start_quiz_attempt(p_quiz_id); end; $$;

create or replace function public.guest_get_quiz_attempt_state(p_token_hash text,p_attempt_id uuid)
returns table(attempt_id uuid,quiz_id uuid,question_count integer,started_at timestamptz,deadline_at timestamptz,
  answers jsonb,status text,submitted_at timestamptz,submission_reason text,total_score integer,correct_count integer,
  incorrect_count integer,unanswered_count integer,percentage numeric,server_now timestamptz)
language plpgsql security definer set search_path=pg_catalog,public,private,auth,pg_temp as $$
begin perform private.set_guest_workspace_context(p_token_hash); return query select * from public.get_quiz_attempt_state(p_attempt_id); end; $$;

create or replace function public.guest_save_quiz_attempt_answers(p_token_hash text,p_attempt_id uuid,p_answers jsonb)
returns table(attempt_id uuid,quiz_id uuid,question_count integer,started_at timestamptz,deadline_at timestamptz,
  answers jsonb,status text,submitted_at timestamptz,submission_reason text,total_score integer,correct_count integer,
  incorrect_count integer,unanswered_count integer,percentage numeric,server_now timestamptz)
language plpgsql security definer set search_path=pg_catalog,public,private,auth,pg_temp as $$
begin perform private.set_guest_workspace_context(p_token_hash); return query select * from public.save_quiz_attempt_answers(p_attempt_id,p_answers); end; $$;

create or replace function public.guest_submit_quiz_attempt(p_token_hash text,p_attempt_id uuid)
returns table(attempt_id uuid,quiz_id uuid,question_count integer,started_at timestamptz,deadline_at timestamptz,
  answers jsonb,status text,submitted_at timestamptz,submission_reason text,total_score integer,correct_count integer,
  incorrect_count integer,unanswered_count integer,percentage numeric,server_now timestamptz)
language plpgsql security definer set search_path=pg_catalog,public,private,auth,pg_temp as $$
begin perform private.set_guest_workspace_context(p_token_hash); return query select * from public.submit_quiz_attempt(p_attempt_id); end; $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure::text sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'guest\_%' escape '\'
  loop
    execute format('revoke all on function %s from public, anon, authenticated',f.sig);
    execute format('grant execute on function %s to service_role',f.sig);
  end loop;
  revoke all on function public.is_feature_enabled(text) from public, anon, authenticated;
  grant execute on function public.is_feature_enabled(text) to service_role;
end; $$;


-- Remove remaining Supabase Auth-dependent policies and direct API access.
do $$
declare
  p record;
  r record;
begin
  for p in select schemaname, tablename, policyname from pg_policies where schemaname in ('public','storage')
  loop
    execute format('drop policy if exists %I on %I.%I',p.policyname,p.schemaname,p.tablename);
  end loop;
  for r in select c.oid::regclass rel from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')
  loop
    execute format('alter table %s enable row level security',r.rel);
    execute format('revoke all on table %s from public, anon, authenticated',r.rel);
    execute format('grant all on table %s to service_role',r.rel);
  end loop;
  revoke all on all functions in schema public from public, anon, authenticated;
  revoke all on all functions in schema private from public, anon, authenticated;
  grant execute on function public.resolve_guest_workspace(text) to service_role;
  grant execute on function public.is_feature_enabled(text) to service_role;
  grant execute on function public.guest_create_learning_document(text,uuid,text,text,text,bigint,text) to service_role;
  grant execute on function public.guest_retry_learning_document(text,uuid) to service_role;
  grant execute on function public.guest_begin_learning_document_delete(text,uuid) to service_role;
  grant execute on function public.guest_cancel_learning_document_delete(text,uuid) to service_role;
  grant execute on function public.guest_finalize_learning_document_delete(text,uuid) to service_role;
  grant execute on function public.guest_start_quiz_attempt(text,uuid) to service_role;
  grant execute on function public.guest_get_quiz_attempt_state(text,uuid) to service_role;
  grant execute on function public.guest_save_quiz_attempt_answers(text,uuid,jsonb) to service_role;
  grant execute on function public.guest_submit_quiz_attempt(text,uuid) to service_role;
end; $$;

-- Deleting auth.users cascades to its identities, sessions, refresh tokens,
-- MFA material, and related Supabase Auth records. Learning tables now point
-- to guest_workspaces and therefore survive.
delete from auth.users;

do $$
begin
  if exists (select 1 from auth.users) then
    raise exception 'Guest migration left Supabase Auth user records';
  end if;
  if exists (select 1 from public.learning_documents d
    left join public.guest_workspaces w on w.id=d.user_id where w.id is null) then
    raise exception 'Guest migration left orphaned learning documents';
  end if;
  if exists (select 1 from public.document_sections s
    left join public.learning_documents d on d.id=s.document_id and d.user_id=s.user_id where d.id is null) then
    raise exception 'Guest migration left orphaned document sections';
  end if;
  if exists (select 1 from public.learning_quizzes q
    left join public.guest_workspaces w on w.id=q.user_id where w.id is null) then
    raise exception 'Guest migration left orphaned quizzes';
  end if;
  if exists (select 1 from public.quiz_attempts a
    left join public.guest_workspaces w on w.id=a.user_id where w.id is null) then
    raise exception 'Guest migration left orphaned examination attempts';
  end if;
  if exists (select 1 from pg_constraint c where c.contype='f' and c.confrelid='auth.users'::regclass
    and c.connamespace='public'::regnamespace) then
    raise exception 'Guest migration left application foreign keys to auth.users';
  end if;
end; $$;


