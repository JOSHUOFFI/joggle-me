-- Run only against the isolated development database after applying
-- 20261125060000_phase7_community.sql. All fixtures and flag changes roll back.
begin;

do $$
begin
  if has_table_privilege('authenticated', 'public.community_posts', 'TRUNCATE')
     or has_column_privilege('authenticated', 'public.community_posts', 'moderation_status', 'UPDATE')
     or has_column_privilege('authenticated', 'public.community_reports', 'report_status', 'UPDATE')
     or has_column_privilege('authenticated', 'public.study_group_members', 'member_role', 'UPDATE') then
    raise exception 'Learners have privileged community mutation grants';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'community_profiles',
        'community_posts',
        'community_comments',
        'community_reactions',
        'community_questions',
        'community_answers',
        'study_groups',
        'study_group_members',
        'community_notifications',
        'community_reports',
        'community_blocks'
      )
      and not c.relrowsecurity
  ) then
    raise exception 'A community table is missing row-level security';
  end if;
end;
$$;

update public.feature_flags
set enabled = true
where key in (
  'community_enabled',
  'community_posts_enabled',
  'community_questions_enabled',
  'study_groups_enabled',
  'community_notifications_enabled'
);

do $$
declare
  learner_one uuid := '10000000-0000-4000-8000-000000000071';
  learner_two uuid := '10000000-0000-4000-8000-000000000072';
  moderator uuid := '10000000-0000-4000-8000-000000000073';
  post_one uuid := '20000000-0000-4000-8000-000000000071';
  post_two uuid := '20000000-0000-4000-8000-000000000072';
  post_three uuid := '20000000-0000-4000-8000-000000000073';
  post_private_group uuid := '20000000-0000-4000-8000-000000000074';
  question_one uuid := '30000000-0000-4000-8000-000000000071';
  answer_one uuid := '40000000-0000-4000-8000-000000000071';
  public_group uuid := '50000000-0000-4000-8000-000000000071';
  private_group uuid := '50000000-0000-4000-8000-000000000072';
begin
  insert into auth.users (id, email, email_confirmed_at)
  values
    (learner_one, 'phase7-learner-one@example.invalid', now()),
    (learner_two, 'phase7-learner-two@example.invalid', now()),
    (moderator, 'phase7-moderator@example.invalid', now())
  on conflict (id) do update set email_confirmed_at = now();

  insert into public.profiles (
    id, first_name, last_name, email, learner_category, account_status
  )
  values
    (learner_one, 'Phase 7', 'One', 'phase7-learner-one@example.invalid', 'independent', 'active'),
    (learner_two, 'Phase 7', 'Two', 'phase7-learner-two@example.invalid', 'independent', 'active'),
    (moderator, 'Phase 7', 'Moderator', 'phase7-moderator@example.invalid', 'independent', 'active')
  on conflict (id) do update set account_status = 'active';

  insert into public.user_roles (user_id, role)
  values
    (learner_one, 'learner'),
    (learner_two, 'learner'),
    (moderator, 'learner'),
    (moderator, 'platform_administrator')
  on conflict do nothing;

  insert into public.community_profiles (
    user_id, display_name, biography, learning_interests, subjects, profile_visible
  )
  values
    (learner_one, 'Visible Learner', 'A public learning introduction.', array['reading'], array['Science'], true),
    (learner_two, 'Private Learner', '', array[]::text[], array[]::text[], false),
    (moderator, 'Moderator Learner', '', array[]::text[], array[]::text[], false);

  insert into public.learner_badges (user_id, badge_key)
  values (learner_one, 'first_steps');

  insert into public.community_posts (id, author_id, post_type, body)
  values
    (post_one, learner_one, 'study_tip', 'Review the lesson notes in short sessions.'),
    (post_two, learner_two, 'discussion', 'What is your favorite science topic?'),
    (post_three, learner_one, 'discussion', 'A second public biology discussion.');

  insert into public.community_questions (
    id, author_id, title, body, subject, topic
  )
  values (
    question_one, learner_one, 'How do plant cells store energy?',
    'I am reviewing photosynthesis and would like a clear explanation.',
    'Biology', 'Photosynthesis'
  );

  insert into public.study_groups (id, created_by, name, description, subject, visibility)
  values
    (public_group, learner_one, 'Open Biology', 'A public biology study group.', 'Biology', 'public'),
    (private_group, learner_one, 'Private Biology', 'A private biology study group.', 'Biology', 'private');

  insert into public.community_posts (id, author_id, group_id, post_type, body)
  values (
    post_private_group, learner_one, private_group, 'discussion',
    'A discussion visible only to private group members.'
  );
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000072', true);
set local role authenticated;

do $$
declare
  report_id uuid;
  answer_id uuid;
  request_id uuid;
  affected_rows integer;
  membership_status text;
  v_rejected boolean := false;
begin
  if exists (select 1 from public.community_posts where id = '20000000-0000-4000-8000-000000000072') is false then
    raise exception 'Learner cannot read their own post';
  end if;
  if exists (select 1 from public.community_posts where id = '20000000-0000-4000-8000-000000000071') is false then
    raise exception 'A visible public community post is not accessible';
  end if;
  if exists (select 1 from public.community_posts where id = '20000000-0000-4000-8000-000000000074') then
    raise exception 'A nonmember can read a private group discussion';
  end if;
  if exists (select 1 from public.community_profiles where user_id = '10000000-0000-4000-8000-000000000071') is false then
    raise exception 'Public community profile is not visible';
  end if;
  if exists (select 1 from public.community_profiles where user_id = '10000000-0000-4000-8000-000000000073') then
    raise exception 'Private community profile is visible to another learner';
  end if;
  update public.community_posts
  set body = 'An unauthorized edit must not change another learner post.'
  where id = '20000000-0000-4000-8000-000000000071';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then raise exception 'A learner edited another learner post'; end if;
  delete from public.community_posts where id = '20000000-0000-4000-8000-000000000071';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then raise exception 'A learner deleted another learner post'; end if;
  update public.community_posts
  set body = 'A learner can still edit their own post.'
  where id = '20000000-0000-4000-8000-000000000072';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception 'A learner cannot edit their own post'; end if;
  if exists (
    select 1 from public.community_notifications
    where recipient_id = auth.uid()
      and event_type = 'post_comment'
  ) then
    raise exception 'A learner can read another learner notification';
  end if;
  if exists (
    select 1 from public.community_visible_badges('10000000-0000-4000-8000-000000000071')
  ) then
    raise exception 'Private learner achievements are exposed';
  end if;

  begin
    perform public.owner_community_overview();
  exception when raise_exception then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'A learner accessed owner community statistics'; end if;

  v_rejected := false;
  insert into public.community_reactions (post_id, user_id, reaction_type)
  values ('20000000-0000-4000-8000-000000000071', auth.uid(), 'like');
  begin
    insert into public.community_reactions (post_id, user_id, reaction_type)
    values ('20000000-0000-4000-8000-000000000071', auth.uid(), 'helpful');
  exception when unique_violation then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'Duplicate post reactions were accepted'; end if;

  insert into public.community_comments (author_id, post_id, body)
  values (auth.uid(), '20000000-0000-4000-8000-000000000071', 'This revision method helped me.');

  insert into public.community_answers (question_id, author_id, body)
  values (
    '30000000-0000-4000-8000-000000000071',
    auth.uid(),
    'Plants convert light energy into chemical energy during photosynthesis.'
  ) returning id into answer_id;
  perform set_config('phase7.answer_id', answer_id::text, true);
  v_rejected := false;
  begin
    perform public.community_accept_answer(
      '30000000-0000-4000-8000-000000000071', answer_id
    );
  exception when raise_exception then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'A learner accepted an answer on someone else question'; end if;

  insert into public.community_reports (reported_by, target_type, target_id, reason)
  values (auth.uid(), 'post', '20000000-0000-4000-8000-000000000071', 'This post needs moderator review')
  returning id into report_id;
  perform set_config('phase7.report_by_learner', report_id::text, true);

  membership_status := public.community_join_group('50000000-0000-4000-8000-000000000071');
  if membership_status <> 'active' then raise exception 'Public group membership did not become active'; end if;
  membership_status := public.community_join_group('50000000-0000-4000-8000-000000000072');
  if membership_status <> 'pending' then raise exception 'Private group membership did not require approval'; end if;

  select gm.id into request_id
  from public.study_group_members gm
  where gm.group_id = '50000000-0000-4000-8000-000000000072'
    and gm.user_id = auth.uid()
    and gm.membership_status = 'pending';
  v_rejected := false;
  begin
    perform public.community_review_group_request(request_id, true);
  exception when raise_exception then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'A pending member approved their own private group request'; end if;

  v_rejected := false;
  begin
    insert into public.study_group_members (group_id, user_id, membership_status)
    values ('50000000-0000-4000-8000-000000000072', auth.uid(), 'active');
  exception when insufficient_privilege then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'A learner joined a private group without approval'; end if;

  v_rejected := false;
  begin
    insert into public.community_posts (author_id, post_type, body)
    values (auth.uid(), 'discussion', 'Contact me at learner@example.com');
  exception when raise_exception then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'Community contact-information validation failed'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000071', true);

do $$
declare
  request_id uuid;
  answer_id uuid := current_setting('phase7.answer_id')::uuid;
begin
  perform public.community_accept_answer(
    '30000000-0000-4000-8000-000000000071',
    answer_id
  );
  if not exists (
    select 1 from public.community_questions
    where id = '30000000-0000-4000-8000-000000000071'
      and question_status = 'answered'
      and accepted_answer_id = answer_id
  ) then
    raise exception 'Question author could not accept an answer';
  end if;

  select id into request_id
  from public.study_group_members
  where group_id = '50000000-0000-4000-8000-000000000072'
    and user_id = '10000000-0000-4000-8000-000000000072'
    and membership_status = 'pending';
  if request_id is null then raise exception 'Private group request is not visible to its admin'; end if;
  perform public.community_review_group_request(request_id, true);
  if not exists (
    select 1 from public.study_group_members
    where id = request_id and membership_status = 'active'
  ) then raise exception 'Group administrator could not approve a membership request'; end if;
  if not exists (
    select 1 from public.community_notifications
    where recipient_id = auth.uid()
      and event_type = 'post_comment'
  ) or not exists (
    select 1 from public.community_notifications
    where recipient_id = auth.uid()
      and event_type = 'question_answer'
  ) or not exists (
    select 1 from public.community_notifications
    where recipient_id = auth.uid()
      and event_type = 'group_request'
  ) then
    raise exception 'Community actions did not create notifications for their recipient';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000072', true);

do $$
begin
  if not exists (
    select 1 from public.community_notifications
    where recipient_id = auth.uid()
      and event_type = 'group_approved'
  ) then
    raise exception 'A private group approval did not notify the requester';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000073', true);

do $$
declare
  own_report uuid;
  other_report uuid := current_setting('phase7.report_by_learner')::uuid;
  v_rejected boolean := false;
begin
  insert into public.community_reports (reported_by, target_type, target_id, reason)
  values (auth.uid(), 'post', '20000000-0000-4000-8000-000000000071', 'Moderator submitted this report')
  returning id into own_report;

  begin
    perform public.owner_moderate_community_report(
      own_report, 'upheld', true, 'A moderator cannot resolve their own report'
    );
  exception when raise_exception then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'A moderator resolved their own report'; end if;

  perform public.owner_moderate_community_report(
    other_report, 'upheld', true, 'The reported content violates community guidelines'
  );
  if not exists (
    select 1 from public.community_posts
    where id = '20000000-0000-4000-8000-000000000071'
      and moderation_status = 'removed'
  ) then
    raise exception 'Moderation did not remove the reported post';
  end if;
  perform set_config('phase7.moderated_report', other_report::text, true);
  perform public.owner_set_community_suspension(
    '10000000-0000-4000-8000-000000000072', true, 7
  );
  perform set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000072', true);
  if public.community_can_participate() then
    raise exception 'Community suspension did not prevent participation';
  end if;
  if not public.is_account_active('10000000-0000-4000-8000-000000000072') then
    raise exception 'Community suspension changed the learner account status';
  end if;
  if not public.has_role('learner') then
    raise exception 'Community suspension changed the learner role';
  end if;
  perform set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000073', true);
  perform public.owner_set_community_suspension(
    '10000000-0000-4000-8000-000000000072', false, 7
  );
end;
$$;

reset role;
do $$
begin
  if not exists (
    select 1 from public.administrative_audit_logs
    where action = 'community.report.reviewed'
      and target_id = current_setting('phase7.moderated_report')
  ) then
    raise exception 'Moderation did not create an administrative audit record';
  end if;
end;
$$;

update public.feature_flags
set enabled = false
where key = 'community_posts_enabled';

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000072', true);
set local role authenticated;

reset role;
update public.community_profiles
set show_achievements = true
where user_id = '10000000-0000-4000-8000-000000000071';
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000072', true);
set local role authenticated;

do $$
begin
  if (
    select count(*) from public.community_visible_badges('10000000-0000-4000-8000-000000000071')
  ) <> 1 then
    raise exception 'Opted-in earned badges are not visible on a public profile';
  end if;
end;
$$;

reset role;
update public.community_profiles
set show_achievements = false
where user_id = '10000000-0000-4000-8000-000000000071';
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000073', true);
set local role authenticated;

do $$
declare
  v_rejected boolean := false;
begin
  begin
    insert into public.community_posts (author_id, post_type, body)
    values (auth.uid(), 'discussion', 'This post should be denied while the feature is disabled');
  exception when insufficient_privilege then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'The post feature flag was not enforced by database policy'; end if;
end;
$$;

reset role;
update public.feature_flags
set enabled = true
where key = 'community_posts_enabled';
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000072', true);
set local role authenticated;

do $$
begin
  if auth.uid() <> '10000000-0000-4000-8000-000000000072' then
    raise exception 'The blocking test is running with the wrong learner identity';
  end if;
  if not public.community_can_participate() then
    raise exception 'The blocking learner is not allowed to participate';
  end if;
  if not public.is_feature_enabled('community_enabled') then
    raise exception 'Community is disabled during the blocking test';
  end if;
  if not public.is_account_active('10000000-0000-4000-8000-000000000071') then
    raise exception 'The learner being blocked is not active';
  end if;
  if not public.community_is_active_learner('10000000-0000-4000-8000-000000000071') then
    raise exception 'The learner being blocked has no active learner role';
  end if;
end;
$$;

insert into public.community_blocks (blocker_id, blocked_id)
values (auth.uid(), '10000000-0000-4000-8000-000000000071');

do $$
begin
  if exists (
    select 1 from public.community_posts
    where id = '20000000-0000-4000-8000-000000000073'
  ) then
    raise exception 'Blocked learner content remains visible';
  end if;
  if exists (
    select 1 from public.community_profiles
    where user_id = '10000000-0000-4000-8000-000000000071'
  ) then
    raise exception 'A blocked learner profile remains visible';
  end if;
end;
$$;

rollback;
