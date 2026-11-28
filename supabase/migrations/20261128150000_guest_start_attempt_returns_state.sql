-- Return the complete attempt state expected by the API instead of discarding
-- the set-returning start_quiz_attempt result into a UUID wrapper.
begin;

drop function public.guest_start_quiz_attempt(text, uuid);

create function public.guest_start_quiz_attempt(p_token_hash text, p_quiz_id uuid)
returns table (
  attempt_id uuid,
  quiz_id uuid,
  question_count integer,
  started_at timestamptz,
  deadline_at timestamptz,
  answers jsonb,
  status text,
  submitted_at timestamptz,
  submission_reason text,
  total_score integer,
  correct_count integer,
  incorrect_count integer,
  unanswered_count integer,
  percentage numeric,
  server_now timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth, pg_temp
as $$
begin
  perform private.set_guest_workspace_context(p_token_hash);
  return query select * from public.start_quiz_attempt(p_quiz_id);
end;
$$;

revoke all on function public.guest_start_quiz_attempt(text, uuid)
  from public, anon, authenticated;
grant execute on function public.guest_start_quiz_attempt(text, uuid)
  to service_role;

notify pgrst, 'reload schema';
commit;
