-- Remove only the 13 empty guest workspaces created by the final serialized
-- Playwright run on 2026-11-28 06:00-07:00 UTC.
create temporary table cleanup_guest_workspace_e2e_targets on commit drop as
select id from public.guest_workspaces
where token_hash is not null
  and created_at >= timestamptz '2026-11-28 06:00:00+00'
  and created_at <  timestamptz '2026-11-28 07:00:00+00'
  and display_name in ('Learner', 'Workspace One');

do $$
declare v_count integer;
begin
  select count(*) into v_count from cleanup_guest_workspace_e2e_targets;
  if v_count <> 13 then raise exception 'Expected 13 final E2E workspaces, found %', v_count; end if;
  if (select count(*) from public.guest_workspaces) <> 15
     or (select count(*) from public.guest_workspaces where token_hash is null) <> 2 then
    raise exception 'Workspace cleanup stopped: legacy inventory changed';
  end if;
  if (select count(*) from public.learning_documents) <> 1
     or (select count(*) from public.document_sections) <> 41
     or (select count(*) from public.learning_quizzes) <> 0
     or (select count(*) from public.quiz_attempts) <> 0
     or (select count(*) from storage.objects where bucket_id='learning-materials') <> 1 then
    raise exception 'Workspace cleanup stopped: learning inventory changed';
  end if;
  if exists(select 1 from cleanup_guest_workspace_e2e_targets t join public.learning_documents x on x.user_id=t.id)
     or exists(select 1 from cleanup_guest_workspace_e2e_targets t join public.document_sections x on x.user_id=t.id)
     or exists(select 1 from cleanup_guest_workspace_e2e_targets t join public.learning_quizzes x on x.user_id=t.id)
     or exists(select 1 from cleanup_guest_workspace_e2e_targets t join public.quiz_attempts x on x.user_id=t.id)
     or exists(select 1 from cleanup_guest_workspace_e2e_targets t join public.community_answers x on x.author_id=t.id)
     or exists(select 1 from cleanup_guest_workspace_e2e_targets t join public.community_blocks x on x.blocked_id=t.id or x.blocker_id=t.id)
     or exists(select 1 from cleanup_guest_workspace_e2e_targets t join public.community_comments x on x.author_id=t.id)
     or exists(select 1 from cleanup_guest_workspace_e2e_targets t join public.community_notifications x on x.actor_id=t.id or x.recipient_id=t.id)
     or exists(select 1 from cleanup_guest_workspace_e2e_targets t join public.community_posts x on x.author_id=t.id)
     or exists(select 1 from cleanup_guest_workspace_e2e_targets t join public.community_profiles x on x.user_id=t.id)
     or exists(select 1 from cleanup_guest_workspace_e2e_targets t join public.community_questions x on x.author_id=t.id)
     or exists(select 1 from cleanup_guest_workspace_e2e_targets t join public.community_reactions x on x.user_id=t.id)
     or exists(select 1 from cleanup_guest_workspace_e2e_targets t join public.community_reports x on x.reported_by=t.id)
     or exists(select 1 from cleanup_guest_workspace_e2e_targets t join public.learner_activity_days x on x.user_id=t.id)
     or exists(select 1 from cleanup_guest_workspace_e2e_targets t join public.learner_badges x on x.user_id=t.id)
     or exists(select 1 from cleanup_guest_workspace_e2e_targets t join public.learner_xp_transactions x on x.user_id=t.id)
     or exists(select 1 from cleanup_guest_workspace_e2e_targets t join public.study_group_members x on x.user_id=t.id)
     or exists(select 1 from cleanup_guest_workspace_e2e_targets t join public.study_groups x on x.created_by=t.id) then
    raise exception 'Workspace cleanup stopped: a candidate owns application data';
  end if;
  delete from public.guest_workspaces w using cleanup_guest_workspace_e2e_targets t where w.id=t.id;
  get diagnostics v_count = row_count;
  if v_count <> 13 then raise exception 'Workspace cleanup deleted % rows; expected 13', v_count; end if;
  if (select count(*) from public.guest_workspaces) <> 2
     or (select count(*) from public.learning_documents) <> 1
     or (select count(*) from public.document_sections) <> 41
     or (select count(*) from storage.objects where bucket_id='learning-materials') <> 1 then
    raise exception 'Workspace cleanup postcondition failed';
  end if;
end; $$;
