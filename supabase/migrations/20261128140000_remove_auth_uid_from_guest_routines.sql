-- Retained learning RPCs use a private guest-workspace context instead of
-- Supabase Auth's auth.uid() helper.
create or replace function private.current_guest_workspace_id()
returns uuid language sql stable security definer
set search_path = pg_catalog, pg_temp
as $$ select nullif(current_setting('joggle.workspace_id', true), '')::uuid; $$;
revoke all on function private.current_guest_workspace_id() from public, anon, authenticated;
grant execute on function private.current_guest_workspace_id() to service_role;

create or replace function public.is_guest_workspace_active(p_id uuid default private.current_guest_workspace_id())
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp
as $$ select exists(select 1 from public.guest_workspaces w where w.id=p_id and w.expires_at>now()); $$;
revoke all on function public.is_guest_workspace_active(uuid) from public, anon, authenticated;
grant execute on function public.is_guest_workspace_active(uuid) to service_role;

create or replace function private.set_guest_workspace_context(p_token_hash text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_id uuid;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid guest workspace capability' using errcode='42501';
  end if;
  update public.guest_workspaces set last_seen_at=now(), expires_at=now()+interval '90 days'
  where token_hash=p_token_hash and expires_at>now() returning id into v_id;
  if v_id is null then
    raise exception 'Guest workspace is expired or unavailable' using errcode='42501';
  end if;
  perform set_config('joggle.workspace_id', v_id::text, true);
  return v_id;
end; $$;
revoke all on function private.set_guest_workspace_context(text) from public, anon, authenticated;
grant execute on function private.set_guest_workspace_context(text) to service_role;

do $$
declare f record; d text;
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.prokind='f'
      and p.proname not in ('current_guest_workspace_id','set_guest_workspace_context')
      and pg_get_functiondef(p.oid) ilike '%auth.uid%'
  loop
    d := pg_get_functiondef(f.oid);
    d := replace(d, 'auth.uid()', 'private.current_guest_workspace_id()');
    if d ilike '%auth.uid%' then
      raise exception 'Could not remove auth.uid from function %', f.oid::regprocedure;
    end if;
    execute d;
  end loop;
end; $$;

do $$
begin
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.prokind='f' and pg_get_functiondef(p.oid) ilike '%auth.uid%') then
    raise exception 'Application routines still reference auth.uid';
  end if;
end; $$;
