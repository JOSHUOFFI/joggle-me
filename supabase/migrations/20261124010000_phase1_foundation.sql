create type public.app_role as enum (
  'learner',
  'teacher',
  'school_administrator',
  'platform_administrator',
  'platform_owner'
);

create type public.learner_category as enum (
  'secondary_school',
  'university',
  'independent'
);

create type public.account_status as enum (
  'active',
  'disabled',
  'pending_verification'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  username text unique,
  email text,
  phone_number text,
  profile_image_url text,
  learner_category public.learner_category not null default 'independent',
  institution text,
  account_status public.account_status not null default 'pending_verification',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint username_format check (username is null or username ~ '^[a-zA-Z0-9._-]{3,30}$')
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint unique_active_role unique nulls not distinct (user_id, role, revoked_at)
);

create table public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null,
  version text not null,
  granted boolean not null,
  granted_at timestamptz,
  withdrawn_at timestamptz,
  source text not null,
  created_at timestamptz not null default now()
);

create table public.feature_flags (
  key text primary key,
  name text not null,
  description text,
  enabled boolean not null default false,
  scope_type text not null default 'platform',
  scope_id uuid,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  constraint feature_scope_check check (
    (scope_type = 'platform' and scope_id is null)
    or (scope_type in ('role', 'user') and scope_id is not null)
  )
);

create table public.feature_flag_rules (
  id uuid primary key default gen_random_uuid(),
  flag_key text not null references public.feature_flags(key) on delete cascade,
  subject_type text not null,
  subject_id uuid,
  enabled boolean not null,
  created_at timestamptz not null default now()
);

create table public.administrative_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  actor_role text,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_hash text,
  correlation_id text,
  created_at timestamptz not null default now(),
  constraint audit_metadata_allowlist check (not metadata ? 'password' and not metadata ? 'secret')
);

create index profiles_status_idx on public.profiles(account_status, created_at);
create index profiles_category_idx on public.profiles(learner_category);
create index user_roles_user_idx on public.user_roles(user_id, revoked_at);
create index user_consents_user_idx on public.user_consents(user_id, purpose);
create index feature_flag_rules_flag_idx on public.feature_flag_rules(flag_key);
create index audit_actor_idx on public.administrative_audit_logs(actor_id, created_at desc);
create index audit_action_idx on public.administrative_audit_logs(action, created_at desc);

create or replace function public.is_account_active(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.account_status = 'active'
      and p.deleted_at is null
  );
$$;

revoke execute on function public.is_account_active(uuid) from public, anon;
grant execute on function public.is_account_active(uuid) to authenticated;

create or replace function public.get_my_roles()
returns table(role public.app_role)
language sql
stable
security definer
set search_path = public
as $$
  select ur.role
  from public.user_roles ur
  where ur.user_id = auth.uid()
    and ur.revoked_at is null
    and public.is_account_active(auth.uid());
$$;

revoke execute on function public.get_my_roles() from public, anon;
grant execute on function public.get_my_roles() to authenticated;

create or replace function public.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = required_role
      and ur.revoked_at is null
      and public.is_account_active(auth.uid())
  );
$$;

create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('platform_owner');
$$;

create or replace function public.has_platform_authority()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('platform_owner', 'platform_administrator')
      and ur.revoked_at is null
      and public.is_account_active(auth.uid())
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    first_name,
    last_name,
    username,
    email,
    learner_category,
    account_status
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    nullif(new.raw_user_meta_data->>'username', ''),
    new.email,
    'independent',
    case
      when new.email_confirmed_at is null
      then 'pending_verification'::public.account_status
      else 'active'::public.account_status
    end
  )
  on conflict (id) do update set
    email = excluded.email,
    account_status = case
      when public.profiles.account_status = 'pending_verification'
        and new.email_confirmed_at is not null
      then 'active'::public.account_status
      else public.profiles.account_status
    end,
    updated_at = now();

  insert into public.user_roles (user_id, role)
  values (new.id, 'learner')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email_confirmed_at on auth.users
for each row execute function public.handle_new_user();

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_profile_updated_at();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_consents enable row level security;
alter table public.feature_flags enable row level security;
alter table public.feature_flag_rules enable row level security;
alter table public.administrative_audit_logs enable row level security;

create policy "Users read own profile"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  and public.is_account_active(auth.uid())
);

create policy "Users update own permitted profile"
on public.profiles for update
to authenticated
using (
  id = auth.uid()
  and public.is_account_active(auth.uid())
)
with check (
  id = auth.uid()
  and public.is_account_active(auth.uid())
);

create policy "Platform authority reads profiles"
on public.profiles for select
to authenticated
using (public.has_platform_authority());

create policy "Users read own roles"
on public.user_roles for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_account_active(auth.uid())
);

create policy "Platform owner reads roles"
on public.user_roles for select
to authenticated
using (public.is_platform_owner());

create policy "Users read own consents"
on public.user_consents for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_account_active(auth.uid())
);

create policy "Users create own consents"
on public.user_consents for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_account_active(auth.uid())
);

create policy "Users update own consents"
on public.user_consents for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and public.is_account_active(auth.uid())
);

create policy "Platform authority reads feature flags"
on public.feature_flags for select
to authenticated
using (public.has_platform_authority());

create policy "Platform owner reads all audit logs"
on public.administrative_audit_logs for select
to authenticated
using (public.is_platform_owner());

create or replace function public.provision_initial_owner(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.user_roles
    where role = 'platform_owner'
      and revoked_at is null
  ) then
    insert into public.user_roles (user_id, role)
    values (p_user_id, 'platform_owner')
    on conflict do nothing;
  else
    raise exception 'An initial platform owner is already provisioned';
  end if;
end;
$$;

revoke execute on function public.provision_initial_owner(uuid) from public, anon, authenticated;
grant execute on function public.provision_initial_owner(uuid) to service_role;

create or replace function public.owner_change_role(
  p_target_user_id uuid,
  p_role public.app_role,
  p_grant boolean,
  p_correlation_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
begin
  if not public.is_platform_owner() then
    raise exception 'Only the platform owner may change roles';
  end if;
  if p_role = 'platform_owner' then
    raise exception 'Owner roles require the separate provisioning procedure';
  end if;

  if p_grant then
    insert into public.user_roles (user_id, role, granted_by)
    values (p_target_user_id, p_role, auth.uid())
    on conflict do update set revoked_at = null, granted_at = now(), granted_by = auth.uid();
  else
    update public.user_roles
    set revoked_at = now()
    where user_id = p_target_user_id
      and role = p_role
      and revoked_at is null;
  end if;

  insert into public.administrative_audit_logs (
    actor_id, actor_role, action, target_type, target_id, metadata, correlation_id
  ) values (
    auth.uid(), 'platform_owner',
    case when p_grant then 'role.granted' else 'role.revoked' end,
    'user', p_target_user_id::text,
    jsonb_build_object('role', p_role::text, 'granted', p_grant),
    p_correlation_id
  );
end;
$$;

create or replace function public.owner_set_account_status(
  p_target_user_id uuid,
  p_status public.account_status,
  p_correlation_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_platform_authority() then
    raise exception 'Insufficient platform authority';
  end if;
  if p_target_user_id = auth.uid() then
    raise exception 'Administrators cannot change their own account status';
  end if;
  if p_status = 'disabled'
    and exists (
      select 1
      from public.user_roles
      where user_id = p_target_user_id
        and role = 'platform_owner'
        and revoked_at is null
    )
    and not public.is_platform_owner()
  then
    raise exception 'Only the platform owner may suspend another platform owner';
  end if;
  update public.profiles
  set account_status = p_status
  where id = p_target_user_id;

  insert into public.administrative_audit_logs (
    actor_id, actor_role, action, target_type, target_id, metadata, correlation_id
  ) values (
    auth.uid(), 'platform_authority',
    'account.status_changed', 'user', p_target_user_id::text,
    jsonb_build_object('account_status', p_status::text),
    p_correlation_id
  );
end;
$$;

create or replace function public.owner_set_feature_flag(
  p_key text,
  p_enabled boolean,
  p_correlation_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_owner() then
    raise exception 'Only the platform owner may change feature flags';
  end if;
  update public.feature_flags
  set enabled = p_enabled, updated_by = auth.uid(), updated_at = now()
  where key = p_key;
  if not found then raise exception 'Unknown feature flag'; end if;

  insert into public.administrative_audit_logs (
    actor_id, actor_role, action, target_type, target_id, metadata, correlation_id
  ) values (
    auth.uid(), 'platform_owner',
    'feature_flag.changed', 'feature_flag', p_key,
    jsonb_build_object('enabled', p_enabled),
    p_correlation_id
  );
end;
$$;

revoke execute on function public.owner_change_role(uuid, public.app_role, boolean, text) from public, anon;
grant execute on function public.owner_change_role(uuid, public.app_role, boolean, text) to authenticated;
revoke execute on function public.owner_set_account_status(uuid, public.account_status, text) from public, anon;
grant execute on function public.owner_set_account_status(uuid, public.account_status, text) to authenticated;
revoke execute on function public.owner_set_feature_flag(text, boolean, text) from public, anon;
grant execute on function public.owner_set_feature_flag(text, boolean, text) to authenticated;

insert into public.feature_flags (key, name, description, enabled) values
  ('user_registration', 'User registration', 'Allow new learner registration', true),
  ('learning_material_uploads', 'Learning material uploads', 'Allow approved document uploads', false),
  ('ai_document_analysis', 'AI document analysis', 'Allow document text and topic analysis', false),
  ('ai_quiz_generation', 'AI quiz generation', 'Allow AI quiz generation', false),
  ('examination_functionality', 'Examination functionality', 'Allow examinations', false),
  ('gamification', 'Gamification', 'Enable gamification experiences', false),
  ('social_learning', 'Social learning', 'Enable social learning features', false),
  ('school_administration', 'School administration', 'Enable school-administrator capabilities', false);

create or replace function public.is_feature_enabled(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select ff.enabled
      from public.feature_flags ff
      where ff.key = p_key
        and ff.scope_type = 'platform'
        and ff.scope_id is null
      limit 1
    ),
    false
  );
$$;

revoke execute on function public.is_feature_enabled(text) from public;
grant execute on function public.is_feature_enabled(text) to anon, authenticated;

create policy "Platform authority reads feature flag rules"
on public.feature_flag_rules for select
to authenticated
using (public.has_platform_authority());

revoke all on public.feature_flags from anon, authenticated;
grant select on public.feature_flags to authenticated;
revoke all on public.feature_flag_rules from anon, authenticated;
grant select on public.feature_flag_rules to authenticated;
revoke all on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;
revoke all on public.user_consents from anon, authenticated;
grant select, insert, update on public.user_consents to authenticated;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (
  first_name,
  last_name,
  username,
  phone_number,
  profile_image_url,
  learner_category,
  institution
) on public.profiles to authenticated;

revoke all on public.administrative_audit_logs from anon, authenticated;
grant select on public.administrative_audit_logs to authenticated;
