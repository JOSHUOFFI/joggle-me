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

drop policy if exists "Users update own permitted profile" on public.profiles;
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
