-- Run only against an isolated Supabase development database.
-- The transaction is rolled back; fixture identities are never persisted.
-- Execute with: npx supabase db query --remote=<development-project-ref> --file supabase/tests/phase1_security.sql

begin;

do $$
declare
  owner_id uuid := '10000000-0000-4000-8000-000000000001';
  learner_id uuid := '10000000-0000-4000-8000-000000000002';
begin
  insert into auth.users (id, email, email_confirmed_at)
  values
    (owner_id, 'phase1-owner@example.invalid', now()),
    (learner_id, 'phase1-learner@example.invalid', now())
  on conflict (id) do update set email_confirmed_at = now();

  insert into public.profiles (
    id, first_name, last_name, email, learner_category, account_status
  )
  values
    (owner_id, 'Phase', 'Owner', 'phase1-owner@example.invalid', 'independent', 'active'),
    (learner_id, 'Phase', 'Learner', 'phase1-learner@example.invalid', 'independent', 'active')
  on conflict (id) do update set account_status = 'active';

  insert into public.user_roles (user_id, role)
  values (owner_id, 'platform_owner'), (learner_id, 'learner')
  on conflict do nothing;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

do $$
declare
  rejected boolean;
begin
  if exists (
    select 1 from public.profiles
    where id = '10000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'learner can read another user profile';
  end if;

  update public.profiles
  set first_name = 'Updated'
  where id = '10000000-0000-4000-8000-000000000002';
  if not found then
    raise exception 'learner cannot update an allowed profile field';
  end if;

  rejected := false;
  begin
    update public.profiles
    set account_status = 'disabled'
    where id = '10000000-0000-4000-8000-000000000002';
  exception when insufficient_privilege then
    rejected := true;
  end;
  if not rejected then
    raise exception 'learner could update protected account status';
  end if;

  rejected := false;
  begin
    insert into public.user_roles (user_id, role)
    values ('10000000-0000-4000-8000-000000000002', 'platform_owner');
  exception when insufficient_privilege then
    rejected := true;
  end;
  if not rejected then
    raise exception 'learner could insert an administrative role';
  end if;

  rejected := false;
  begin
    insert into public.administrative_audit_logs (
      actor_id, action, target_type, target_id
    ) values (
      '10000000-0000-4000-8000-000000000002',
      'audit.forged',
      'user',
      '10000000-0000-4000-8000-000000000002'
    );
  exception when insufficient_privilege then
    rejected := true;
  end;
  if not rejected then
    raise exception 'learner could insert an audit record';
  end if;

  rejected := false;
  begin
    perform public.owner_set_feature_flag('user_registration', false);
  exception when raise_exception then
    rejected := true;
  end;
  if not rejected then
    raise exception 'learner invoked an owner-only feature operation';
  end if;

  rejected := false;
  begin
    update public.administrative_audit_logs set action = 'forged';
  exception when insufficient_privilege then
    rejected := true;
  end;
  if not rejected then
    raise exception 'learner could update an audit record';
  end if;

  rejected := false;
  begin
    delete from public.administrative_audit_logs;
  exception when insufficient_privilege then
    rejected := true;
  end;
  if not rejected then
    raise exception 'learner could delete an audit record';
  end if;

  if public.has_role('platform_owner') then
    raise exception 'learner has owner privileges';
  end if;
end;
$$;

reset role;

update public.profiles
set account_status = 'disabled'
where id = '10000000-0000-4000-8000-000000000002';

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

do $$
begin
  if exists (
    select 1 from public.profiles
    where id = '10000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'disabled user still has profile RLS access';
  end if;

  if public.is_account_active('10000000-0000-4000-8000-000000000002') then
    raise exception 'disabled user is reported active';
  end if;

  if exists (select 1 from public.get_my_roles()) then
    raise exception 'disabled user still resolves an active role';
  end if;
end;
$$;

reset role;

update public.feature_flags
set enabled = false
where key = 'user_registration';

do $$
begin
  if public.is_feature_enabled('user_registration') then
    raise exception 'disabled registration feature was reported enabled';
  end if;

  if public.is_feature_enabled('missing_feature') then
    raise exception 'missing feature was reported enabled';
  end if;
end;
$$;

rollback;
