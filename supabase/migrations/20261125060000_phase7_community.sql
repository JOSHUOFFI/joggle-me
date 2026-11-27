insert into public.feature_flags (key, name, description, enabled)
values
  ('community_enabled', 'Community', 'Enable the learner community area', false),
  ('community_posts_enabled', 'Community posts', 'Enable community posts, comments and reactions', false),
  ('community_questions_enabled', 'Community questions', 'Enable academic questions and answers', false),
  ('study_groups_enabled', 'Study groups', 'Enable study groups and group discussions', false),
  ('community_notifications_enabled', 'Community notifications', 'Enable in-app community notifications', false)
on conflict (key) do nothing;

create table public.study_groups (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 3 and 80),
  description text not null check (length(trim(description)) between 1 and 1200),
  subject text not null check (length(trim(subject)) between 1 and 80),
  visibility text not null check (visibility in ('public', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index study_groups_created_idx on public.study_groups (created_at desc);
create index study_groups_subject_idx on public.study_groups (subject, visibility);

create table public.study_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('admin', 'member')),
  membership_status text not null check (membership_status in ('pending', 'active', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_group_members_user_unique unique (group_id, user_id)
);

create index study_group_members_user_status_idx
  on public.study_group_members (user_id, membership_status);
create index study_group_members_group_status_idx
  on public.study_group_members (group_id, membership_status, member_role);

create table public.community_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Learner'
    check (length(trim(display_name)) between 1 and 60),
  avatar_url text check (
    avatar_url is null or (
      length(avatar_url) <= 500
      and avatar_url ~ '^https://'
      and position('?' in avatar_url) = 0
      and position('#' in avatar_url) = 0
    )
  ),
  biography text not null default '' check (length(biography) <= 300),
  learning_interests text[] not null default '{}'
    check (cardinality(learning_interests) <= 10),
  subjects text[] not null default '{}'
    check (cardinality(subjects) <= 10),
  profile_visible boolean not null default false,
  show_achievements boolean not null default false,
  community_suspended_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid references public.study_groups(id) on delete cascade,
  post_type text not null check (post_type in ('discussion', 'study_tip', 'achievement')),
  body text not null check (length(trim(body)) between 1 and 3000),
  moderation_status text not null default 'visible'
    check (moderation_status in ('visible', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index community_posts_feed_idx
  on public.community_posts (created_at desc, id desc)
  where moderation_status = 'visible';
create index community_posts_group_feed_idx
  on public.community_posts (group_id, created_at desc, id desc)
  where group_id is not null and moderation_status = 'visible';
create index community_posts_author_idx on public.community_posts (author_id, created_at desc);

create table public.community_questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid references public.study_groups(id) on delete cascade,
  title text not null check (length(trim(title)) between 5 and 180),
  body text not null check (length(trim(body)) between 1 and 3000),
  subject text not null check (length(trim(subject)) between 1 and 80),
  topic text not null default '' check (length(topic) <= 100),
  question_status text not null default 'open'
    check (question_status in ('open', 'answered', 'closed')),
  moderation_status text not null default 'visible'
    check (moderation_status in ('visible', 'removed')),
  accepted_answer_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index community_questions_feed_idx
  on public.community_questions (question_status, created_at desc, id desc)
  where moderation_status = 'visible';
create index community_questions_subject_topic_idx
  on public.community_questions (subject, topic, question_status);
create index community_questions_group_idx
  on public.community_questions (group_id, created_at desc)
  where group_id is not null;

create table public.community_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.community_questions(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 3000),
  moderation_status text not null default 'visible'
    check (moderation_status in ('visible', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_answers_id_question_unique unique (id, question_id)
);

alter table public.community_questions
  add constraint community_questions_accepted_answer_fkey
  foreign key (accepted_answer_id, id)
  references public.community_answers (id, question_id)
  on delete set null (accepted_answer_id);

create index community_answers_question_idx
  on public.community_answers (question_id, created_at)
  where moderation_status = 'visible';

create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.community_posts(id) on delete cascade,
  answer_id uuid references public.community_answers(id) on delete cascade,
  parent_comment_id uuid references public.community_comments(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 1500),
  moderation_status text not null default 'visible'
    check (moderation_status in ('visible', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_comment_one_target check ((post_id is null) <> (answer_id is null))
);

create index community_comments_post_idx
  on public.community_comments (post_id, created_at)
  where post_id is not null and moderation_status = 'visible';
create index community_comments_answer_idx
  on public.community_comments (answer_id, created_at)
  where answer_id is not null and moderation_status = 'visible';
create index community_comments_parent_idx
  on public.community_comments (parent_comment_id, created_at)
  where parent_comment_id is not null and moderation_status = 'visible';

create table public.community_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction_type text not null default 'like' check (reaction_type in ('like', 'helpful', 'celebrate')),
  created_at timestamptz not null default now(),
  constraint community_reactions_user_post_unique unique (post_id, user_id)
);

create index community_reactions_post_idx on public.community_reactions (post_id);

create table public.community_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'post_comment',
      'comment_reply',
      'answer_comment',
      'question_answer',
      'post_reaction',
      'group_request',
      'group_approved',
      'group_rejected'
    )
  ),
  target_type text not null check (
    target_type in ('post', 'comment', 'answer', 'question', 'study_group')
  ),
  target_id uuid not null,
  source_id uuid not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint community_notifications_dedupe_unique
    unique (recipient_id, event_type, source_id),
  constraint community_notifications_no_self
    check (recipient_id <> actor_id)
);

create index community_notifications_inbox_idx
  on public.community_notifications (recipient_id, created_at desc)
  where read_at is null;

create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reported_by uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'question', 'answer')),
  target_id uuid not null,
  reason text not null check (length(trim(reason)) between 3 and 500),
  report_status text not null default 'pending'
    check (report_status in ('pending', 'upheld', 'dismissed')),
  resolution text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint community_reports_reporter_target_unique
    unique (reported_by, target_type, target_id)
);

create index community_reports_queue_idx
  on public.community_reports (created_at desc)
  where report_status = 'pending';

create table public.community_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint community_blocks_no_self check (blocker_id <> blocked_id)
);

create index community_blocks_reverse_idx on public.community_blocks (blocked_id, blocker_id);

create or replace function public.community_can_participate()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select auth.uid() is not null
    and public.is_account_active(auth.uid())
    and public.has_role('learner')
    and public.is_feature_enabled('community_enabled')
    and not exists (
      select 1
      from public.community_profiles cp
      where cp.user_id = auth.uid()
        and cp.community_suspended_until > now()
    );
$$;

create or replace function public.community_is_active_learner(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select public.is_account_active(p_user_id)
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = p_user_id
        and ur.role = 'learner'
        and ur.revoked_at is null
    );
$$;

create or replace function public.community_is_blocked(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.community_blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p_other_user_id)
       or (b.blocker_id = p_other_user_id and b.blocked_id = auth.uid())
  );
$$;

create or replace function public.community_is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.study_group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = auth.uid()
      and gm.membership_status = 'active'
  );
$$;

create or replace function public.community_is_group_admin(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.study_group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = auth.uid()
      and gm.membership_status = 'active'
      and gm.member_role = 'admin'
  );
$$;

create or replace function public.community_can_read_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select public.community_can_participate()
    and public.is_feature_enabled('community_posts_enabled')
    and exists (
      select 1
      from public.community_posts p
      where p.id = p_post_id
        and p.moderation_status = 'visible'
        and public.community_is_active_learner(p.author_id)
        and not public.community_is_blocked(p.author_id)
        and (p.group_id is null or public.community_is_group_member(p.group_id))
    );
$$;

create or replace function public.community_can_read_question(p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select public.community_can_participate()
    and public.is_feature_enabled('community_questions_enabled')
    and exists (
      select 1
      from public.community_questions q
      where q.id = p_question_id
        and q.moderation_status = 'visible'
        and public.community_is_active_learner(q.author_id)
        and not public.community_is_blocked(q.author_id)
        and (q.group_id is null or public.community_is_group_member(q.group_id))
    );
$$;

create or replace function public.community_can_read_answer(p_answer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.community_answers a
    where a.id = p_answer_id
      and a.moderation_status = 'visible'
      and public.community_is_active_learner(a.author_id)
      and not public.community_is_blocked(a.author_id)
      and public.community_can_read_question(a.question_id)
  );
$$;

create or replace function public.community_can_read_comment(p_comment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select public.community_can_participate()
    and public.is_feature_enabled('community_posts_enabled')
    and exists (
      select 1
      from public.community_comments c
      where c.id = p_comment_id
        and c.moderation_status = 'visible'
        and public.community_is_active_learner(c.author_id)
        and not public.community_is_blocked(c.author_id)
        and (
          (c.post_id is not null and public.community_can_read_post(c.post_id))
          or (c.answer_id is not null and public.community_can_read_answer(c.answer_id))
        )
    );
$$;

create or replace function public.community_post_statistics(p_post_ids uuid[])
returns table (
  post_id uuid,
  reaction_count bigint,
  comment_count bigint,
  reacted_by_me boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if coalesce(cardinality(p_post_ids), 0) > 20 then
    raise exception 'At most 20 posts can be summarized at a time';
  end if;
  return query
  select
    p.id,
    count(distinct r.id),
    count(distinct c.id),
    coalesce(bool_or(r.user_id = auth.uid()), false)
  from public.community_posts p
  left join public.community_reactions r on r.post_id = p.id
  left join public.community_comments c
    on c.post_id = p.id and c.moderation_status = 'visible'
  where p.id = any(coalesce(p_post_ids, array[]::uuid[]))
    and public.community_can_read_post(p.id)
  group by p.id;
end;
$$;

create or replace function public.community_join_group(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_visibility text;
  v_status text;
  v_next_status text;
begin
  if not public.community_can_participate()
     or not public.is_feature_enabled('study_groups_enabled') then
    raise exception 'Study groups are unavailable';
  end if;
  select g.visibility into v_visibility
  from public.study_groups g
  where g.id = p_group_id
    and public.community_is_active_learner(g.created_by)
    and not public.community_is_blocked(g.created_by);
  if not found then
    raise exception 'The study group is unavailable';
  end if;

  v_next_status := case when v_visibility = 'public' then 'active' else 'pending' end;
  select gm.membership_status into v_status
  from public.study_group_members gm
  where gm.group_id = p_group_id and gm.user_id = auth.uid()
  for update;
  if found and v_status in ('active', 'pending') then
    return v_status;
  end if;
  if found then
    update public.study_group_members
    set membership_status = v_next_status
    where group_id = p_group_id and user_id = auth.uid();
    return v_next_status;
  end if;
  insert into public.study_group_members (group_id, user_id, membership_status)
  values (p_group_id, auth.uid(), v_next_status);
  return v_next_status;
end;
$$;

create or replace function public.community_set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.community_group_statistics(p_group_ids uuid[])
returns table (
  group_id uuid,
  member_count bigint,
  my_status text,
  is_admin boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if coalesce(cardinality(p_group_ids), 0) > 20 then
    raise exception 'At most 20 groups can be summarized at a time';
  end if;
  return query
  select
    g.id,
    count(gm.id) filter (
      where gm.membership_status = 'active'
        and public.community_is_active_learner(gm.user_id)
    ),
    (select own_membership.membership_status
      from public.study_group_members own_membership
      where own_membership.group_id = g.id
        and own_membership.user_id = auth.uid()),
    public.community_is_group_admin(g.id)
  from public.study_groups g
  left join public.study_group_members gm on gm.group_id = g.id
  where g.id = any(coalesce(p_group_ids, array[]::uuid[]))
    and public.community_can_participate()
    and public.is_feature_enabled('study_groups_enabled')
    and public.community_is_active_learner(g.created_by)
    and not public.community_is_blocked(g.created_by)
  group by g.id;
end;
$$;

create or replace function public.community_visible_badges(p_user_id uuid)
returns table (badge_key text, awarded_at timestamptz)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if not public.community_can_participate()
     or public.community_is_blocked(p_user_id)
     or not public.community_is_active_learner(p_user_id)
     or not exists (
       select 1
       from public.community_profiles cp
       where cp.user_id = p_user_id
         and cp.profile_visible
         and cp.show_achievements
     ) then
    return;
  end if;
  return query
  select b.badge_key, b.awarded_at
  from public.learner_badges b
  where b.user_id = p_user_id
  order by b.awarded_at desc
  limit 20;
end;
$$;

create or replace function public.community_validate_text()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_content text := concat_ws(
    ' ',
    to_jsonb(new) ->> 'body',
    to_jsonb(new) ->> 'title',
    to_jsonb(new) ->> 'description',
    to_jsonb(new) ->> 'biography',
    to_jsonb(new) ->> 'reason',
    to_jsonb(new) ->> 'name',
    to_jsonb(new) ->> 'display_name',
    to_jsonb(new) ->> 'avatar_url',
    to_jsonb(new) ->> 'subject',
    to_jsonb(new) ->> 'topic',
    to_jsonb(new) ->> 'learning_interests',
    to_jsonb(new) ->> 'subjects'
  );
begin
  if v_content ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
     or v_content ~ '(^|[^0-9])\+?[0-9][0-9 ()-]{8,}[0-9]([^0-9]|$)' then
    raise exception 'Contact information is not allowed in community content';
  end if;
  return new;
end;
$$;

create or replace function public.community_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_author_id uuid := coalesce(
    (to_jsonb(new) ->> 'author_id')::uuid,
    (to_jsonb(new) ->> 'reported_by')::uuid,
    (to_jsonb(new) ->> 'created_by')::uuid
  );
  v_recent_count bigint;
begin
  if v_author_id is null then
    raise exception 'A community author is required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_author_id::text, 0));
  select
    (select count(*) from public.community_posts p
      where p.author_id = v_author_id and p.created_at > now() - interval '10 minutes')
    + (select count(*) from public.community_comments c
      where c.author_id = v_author_id and c.created_at > now() - interval '10 minutes')
    + (select count(*) from public.community_questions q
      where q.author_id = v_author_id and q.created_at > now() - interval '10 minutes')
    + (select count(*) from public.community_answers a
      where a.author_id = v_author_id and a.created_at > now() - interval '10 minutes')
    + (select count(*) from public.study_groups g
      where g.created_by = v_author_id and g.created_at > now() - interval '10 minutes')
    + (select count(*) from public.community_reports r
      where r.reported_by = v_author_id and r.created_at > now() - interval '10 minutes')
  into v_recent_count;
  if v_recent_count >= 20 then
    raise exception 'Community contribution rate limit reached';
  end if;
  return new;
end;
$$;

create or replace function public.community_validate_comment_parent()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_parent public.community_comments%rowtype;
begin
  if new.parent_comment_id is null then return new; end if;
  select * into v_parent
  from public.community_comments c
  where c.id = new.parent_comment_id
    and c.moderation_status = 'visible';
  if not found
     or v_parent.parent_comment_id is not null
     or v_parent.post_id is distinct from new.post_id
     or v_parent.answer_id is distinct from new.answer_id then
    raise exception 'Replies must reference a visible top-level comment in the same discussion';
  end if;
  return new;
end;
$$;

create or replace function public.community_validate_report()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_author_id uuid;
begin
  case new.target_type
    when 'post' then
      select p.author_id into v_author_id from public.community_posts p
      where p.id = new.target_id and p.moderation_status = 'visible'
        and public.community_can_read_post(p.id);
    when 'comment' then
      select c.author_id into v_author_id from public.community_comments c
      where c.id = new.target_id and c.moderation_status = 'visible'
        and public.community_can_read_comment(c.id);
    when 'question' then
      select q.author_id into v_author_id from public.community_questions q
      where q.id = new.target_id and q.moderation_status = 'visible'
        and public.community_can_read_question(q.id);
    when 'answer' then
      select a.author_id into v_author_id from public.community_answers a
      where a.id = new.target_id and a.moderation_status = 'visible'
        and public.community_can_read_answer(a.id);
  end case;
  if v_author_id is null then
    raise exception 'The reported community content is unavailable';
  end if;
  if v_author_id = new.reported_by then
    raise exception 'You cannot report your own content';
  end if;
  return new;
end;
$$;

create or replace function public.community_create_group_admin()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  insert into public.study_group_members (
    group_id, user_id, member_role, membership_status
  )
  values (new.id, new.created_by, 'admin', 'active');
  return new;
end;
$$;

create or replace function public.community_notify(
  p_recipient_id uuid,
  p_actor_id uuid,
  p_event_type text,
  p_target_type text,
  p_target_id uuid,
  p_source_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if p_recipient_id is null
     or p_actor_id is null
     or p_recipient_id = p_actor_id
     or not public.is_feature_enabled('community_notifications_enabled')
     or not public.is_account_active(p_recipient_id)
     or exists (
       select 1 from public.community_blocks b
       where (b.blocker_id = p_recipient_id and b.blocked_id = p_actor_id)
          or (b.blocker_id = p_actor_id and b.blocked_id = p_recipient_id)
     ) then
    return;
  end if;
  insert into public.community_notifications (
    recipient_id, actor_id, event_type, target_type, target_id, source_id
  )
  values (
    p_recipient_id, p_actor_id, p_event_type, p_target_type, p_target_id, p_source_id
  )
  on conflict (recipient_id, event_type, source_id) do nothing;
end;
$$;

create or replace function public.community_notify_comment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_recipient_id uuid;
  v_event_type text;
  v_target_type text;
  v_target_id uuid;
begin
  if new.parent_comment_id is not null then
    select c.author_id into v_recipient_id
    from public.community_comments c where c.id = new.parent_comment_id;
    v_event_type := 'comment_reply';
    v_target_type := 'comment';
    v_target_id := new.parent_comment_id;
  elsif new.post_id is not null then
    select p.author_id into v_recipient_id
    from public.community_posts p where p.id = new.post_id;
    v_event_type := 'post_comment';
    v_target_type := 'post';
    v_target_id := new.post_id;
  else
    select a.author_id into v_recipient_id
    from public.community_answers a where a.id = new.answer_id;
    v_event_type := 'answer_comment';
    v_target_type := 'answer';
    v_target_id := new.answer_id;
  end if;
  perform public.community_notify(
    v_recipient_id, new.author_id, v_event_type, v_target_type, v_target_id, new.id
  );
  return new;
end;
$$;

create or replace function public.community_notify_reaction()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_author_id uuid;
begin
  select p.author_id into v_author_id
  from public.community_posts p where p.id = new.post_id;
  perform public.community_notify(
    v_author_id, new.user_id, 'post_reaction', 'post', new.post_id, new.id
  );
  return new;
end;
$$;

create or replace function public.community_notify_answer()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_author_id uuid;
begin
  select q.author_id into v_author_id
  from public.community_questions q where q.id = new.question_id;
  perform public.community_notify(
    v_author_id, new.author_id, 'question_answer', 'question', new.question_id, new.id
  );
  return new;
end;
$$;

create or replace function public.community_notify_group_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_admin_id uuid;
begin
  if new.membership_status <> 'pending' then return new; end if;
  for v_admin_id in
    select gm.user_id
    from public.study_group_members gm
    where gm.group_id = new.group_id
      and gm.member_role = 'admin'
      and gm.membership_status = 'active'
  loop
    perform public.community_notify(
      v_admin_id, new.user_id, 'group_request', 'study_group', new.group_id, new.id
    );
  end loop;
  return new;
end;
$$;

create or replace function public.community_accept_answer(
  p_question_id uuid,
  p_answer_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if not public.community_can_participate()
     or not public.is_feature_enabled('community_questions_enabled') then
    raise exception 'Community questions are unavailable';
  end if;
  if not exists (
    select 1 from public.community_questions q
    where q.id = p_question_id
      and q.author_id = auth.uid()
      and q.moderation_status = 'visible'
  ) then
    raise exception 'Only the question author can accept an answer';
  end if;
  if not exists (
    select 1 from public.community_answers a
    where a.id = p_answer_id
      and a.question_id = p_question_id
      and a.moderation_status = 'visible'
      and not public.community_is_blocked(a.author_id)
  ) then
    raise exception 'The answer is unavailable';
  end if;
  update public.community_questions
  set accepted_answer_id = p_answer_id,
      question_status = 'answered',
      updated_at = now()
  where id = p_question_id;
end;
$$;

create or replace function public.community_review_group_request(
  p_membership_id uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_membership public.study_group_members%rowtype;
  v_group_visibility text;
  v_next_status text := case when p_approve then 'active' else 'rejected' end;
begin
  if not public.community_can_participate()
     or not public.is_feature_enabled('study_groups_enabled') then
    raise exception 'Study groups are unavailable';
  end if;
  select * into v_membership
  from public.study_group_members gm
  where gm.id = p_membership_id
  for update;
  if not found or v_membership.membership_status <> 'pending' then
    raise exception 'The membership request is unavailable';
  end if;
  if not public.community_is_group_admin(v_membership.group_id) then
    raise exception 'Only a group administrator can review membership requests';
  end if;
  select g.visibility into v_group_visibility
  from public.study_groups g where g.id = v_membership.group_id;
  if v_group_visibility <> 'private' then
    raise exception 'Only private group requests require review';
  end if;

  update public.study_group_members
  set membership_status = v_next_status, updated_at = now()
  where id = p_membership_id;
  perform public.community_notify(
    v_membership.user_id,
    auth.uid(),
    case when p_approve then 'group_approved' else 'group_rejected' end,
    'study_group',
    v_membership.group_id,
    v_membership.id
  );
end;
$$;

create or replace function public.owner_moderate_community_report(
  p_report_id uuid,
  p_decision text,
  p_remove_content boolean,
  p_resolution text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_report public.community_reports%rowtype;
begin
  if not public.has_platform_authority() then
    raise exception 'Platform authority is required for community moderation';
  end if;
  if p_decision not in ('upheld', 'dismissed')
     or length(trim(coalesce(p_resolution, ''))) not between 3 and 500
     or (p_decision = 'dismissed' and p_remove_content) then
    raise exception 'The moderation decision is invalid';
  end if;
  select * into v_report
  from public.community_reports r
  where r.id = p_report_id
  for update;
  if not found or v_report.report_status <> 'pending' then
    raise exception 'The report is unavailable or already resolved';
  end if;
  if v_report.reported_by = auth.uid() then
    raise exception 'A moderator cannot resolve their own report';
  end if;

  if p_remove_content then
    case v_report.target_type
      when 'post' then
        update public.community_posts set moderation_status = 'removed', updated_at = now()
        where id = v_report.target_id;
      when 'comment' then
        update public.community_comments set moderation_status = 'removed', updated_at = now()
        where id = v_report.target_id;
      when 'question' then
        update public.community_questions set moderation_status = 'removed', updated_at = now()
        where id = v_report.target_id;
      when 'answer' then
        update public.community_answers set moderation_status = 'removed', updated_at = now()
        where id = v_report.target_id;
    end case;
  end if;

  update public.community_reports
  set report_status = p_decision,
      resolution = trim(p_resolution),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = v_report.id;

  insert into public.administrative_audit_logs (
    actor_id, actor_role, action, target_type, target_id, metadata
  )
  values (
    auth.uid(),
    case when public.is_platform_owner() then 'platform_owner' else 'platform_administrator' end,
    'community.report.reviewed',
    'community_report',
    v_report.id::text,
    jsonb_build_object(
      'decision', p_decision,
      'content_removed', p_remove_content,
      'target_type', v_report.target_type
    )
  );
end;
$$;

create or replace function public.owner_set_community_suspension(
  p_target_user_id uuid,
  p_suspend boolean,
  p_duration_days integer default 7
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if not public.has_platform_authority() then
    raise exception 'Platform authority is required to change community participation';
  end if;
  if p_target_user_id = auth.uid() then
    raise exception 'Moderators cannot change their own community status';
  end if;
  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_target_user_id
      and ur.role = 'learner'
      and ur.revoked_at is null
      and public.is_account_active(ur.user_id)
  ) then
    raise exception 'Only learner community participation can be suspended';
  end if;
  if p_suspend and (p_duration_days is null or p_duration_days not between 1 and 365) then
    raise exception 'Suspension duration must be between 1 and 365 days';
  end if;

  insert into public.community_profiles (user_id, display_name, community_suspended_until)
  values (
    p_target_user_id,
    'Learner',
    case when p_suspend then now() + make_interval(days => p_duration_days) else null end
  )
  on conflict (user_id) do update
  set community_suspended_until = excluded.community_suspended_until,
      updated_at = now();

  insert into public.administrative_audit_logs (
    actor_id, actor_role, action, target_type, target_id, metadata
  )
  values (
    auth.uid(),
    case when public.is_platform_owner() then 'platform_owner' else 'platform_administrator' end,
    case when p_suspend then 'community.participation.suspended' else 'community.participation.restored' end,
    'user',
    p_target_user_id::text,
    jsonb_build_object(
      'suspended', p_suspend,
      'duration_days', case when p_suspend then p_duration_days else null end
    )
  );
end;
$$;

create or replace function public.owner_community_overview()
returns table (
  visible_posts bigint,
  visible_questions bigint,
  study_groups bigint,
  active_memberships bigint,
  pending_reports bigint,
  suspended_learners bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if not public.has_platform_authority() then
    raise exception 'Platform authority is required for community statistics';
  end if;
  return query
  select
    (select count(*) from public.community_posts p where p.moderation_status = 'visible'),
    (select count(*) from public.community_questions q where q.moderation_status = 'visible'),
    (select count(*) from public.study_groups),
    (select count(*) from public.study_group_members gm where gm.membership_status = 'active'),
    (select count(*) from public.community_reports r where r.report_status = 'pending'),
    (select count(*) from public.community_profiles cp where cp.community_suspended_until > now());
end;
$$;

create or replace function public.owner_list_community_learners(
  p_limit integer default 100,
  p_search text default null
)
returns table (
  user_id uuid,
  display_name text,
  community_suspended_until timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if not public.has_platform_authority() then
    raise exception 'Platform authority is required to manage community participation';
  end if;
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'The learner list limit is invalid';
  end if;
  if length(trim(coalesce(p_search, ''))) > 100 then
    raise exception 'The learner search is too long';
  end if;
  return query
  select
    ur.user_id,
    coalesce(
      nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
      nullif(cp.display_name, ''),
      'Learner'
    ),
    cp.community_suspended_until
  from public.user_roles ur
  left join public.profiles p on p.id = ur.user_id and p.deleted_at is null
  left join public.community_profiles cp on cp.user_id = ur.user_id
  where ur.role = 'learner'
    and ur.revoked_at is null
    and public.is_account_active(ur.user_id)
    and (
      nullif(trim(p_search), '') is null
      or position(
        lower(trim(p_search))
        in lower(concat_ws(' ', p.first_name, p.last_name, p.username, cp.display_name))
      ) > 0
    )
  order by ur.created_at desc
  limit p_limit;
end;
$$;

create trigger study_group_creator_admin
after insert on public.study_groups
for each row execute function public.community_create_group_admin();

create trigger community_validate_post_text
before insert or update on public.community_posts
for each row execute function public.community_validate_text();
create trigger community_validate_comment_text
before insert or update on public.community_comments
for each row execute function public.community_validate_text();
create trigger community_validate_question_text
before insert or update on public.community_questions
for each row execute function public.community_validate_text();
create trigger community_validate_answer_text
before insert or update on public.community_answers
for each row execute function public.community_validate_text();
create trigger community_validate_group_text
before insert or update on public.study_groups
for each row execute function public.community_validate_text();
create trigger community_validate_profile_text
before insert or update on public.community_profiles
for each row execute function public.community_validate_text();
create trigger community_validate_report_text
before insert or update on public.community_reports
for each row execute function public.community_validate_text();

create trigger community_rate_posts
before insert on public.community_posts
for each row execute function public.community_rate_limit();
create trigger community_rate_comments
before insert on public.community_comments
for each row execute function public.community_rate_limit();
create trigger community_rate_questions
before insert on public.community_questions
for each row execute function public.community_rate_limit();
create trigger community_rate_answers
before insert on public.community_answers
for each row execute function public.community_rate_limit();
create trigger community_rate_groups
before insert on public.study_groups
for each row execute function public.community_rate_limit();
create trigger community_rate_reports
before insert on public.community_reports
for each row execute function public.community_rate_limit();

create trigger community_comment_parent_check
before insert or update on public.community_comments
for each row execute function public.community_validate_comment_parent();
create trigger community_report_target_check
before insert on public.community_reports
for each row execute function public.community_validate_report();

create trigger community_comment_notification
after insert on public.community_comments
for each row execute function public.community_notify_comment();
create trigger community_reaction_notification
after insert on public.community_reactions
for each row execute function public.community_notify_reaction();
create trigger community_answer_notification
after insert on public.community_answers
for each row execute function public.community_notify_answer();
create trigger community_group_request_notification
after insert on public.study_group_members
for each row execute function public.community_notify_group_request();
create trigger community_group_rerequest_notification
after update of membership_status on public.study_group_members
for each row
when (old.membership_status = 'rejected' and new.membership_status = 'pending')
execute function public.community_notify_group_request();

create trigger community_profiles_updated_at
before update on public.community_profiles
for each row execute function public.community_set_updated_at();
create trigger community_posts_updated_at
before update on public.community_posts
for each row execute function public.community_set_updated_at();
create trigger community_comments_updated_at
before update on public.community_comments
for each row execute function public.community_set_updated_at();
create trigger community_questions_updated_at
before update on public.community_questions
for each row execute function public.community_set_updated_at();
create trigger community_answers_updated_at
before update on public.community_answers
for each row execute function public.community_set_updated_at();
create trigger study_groups_updated_at
before update on public.study_groups
for each row execute function public.community_set_updated_at();
create trigger study_group_members_updated_at
before update on public.study_group_members
for each row execute function public.community_set_updated_at();

alter table public.community_profiles enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reactions enable row level security;
alter table public.community_questions enable row level security;
alter table public.community_answers enable row level security;
alter table public.study_groups enable row level security;
alter table public.study_group_members enable row level security;
alter table public.community_notifications enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_blocks enable row level security;

create policy "Learners read own or public community profiles"
on public.community_profiles for select to authenticated
using (
  public.community_can_participate()
  and (user_id = auth.uid() or (profile_visible and not public.community_is_blocked(user_id)))
  and (user_id = auth.uid() or public.community_is_active_learner(user_id))
);
create policy "Learners create own community profile"
on public.community_profiles for insert to authenticated
with check (
  user_id = auth.uid()
  and community_suspended_until is null
  and public.community_can_participate()
);
create policy "Learners update own community profile"
on public.community_profiles for update to authenticated
using (user_id = auth.uid() and public.community_can_participate())
with check (user_id = auth.uid() and public.community_can_participate());

create policy "Learners read visible accessible posts"
on public.community_posts for select to authenticated
using (
  moderation_status = 'visible'
  and public.community_can_participate()
  and public.is_feature_enabled('community_posts_enabled')
  and public.community_is_active_learner(author_id)
  and not public.community_is_blocked(author_id)
  and (group_id is null or public.community_is_group_member(group_id))
);
create policy "Community moderators read posts"
on public.community_posts for select to authenticated
using (public.has_platform_authority());
create policy "Learners create community posts"
on public.community_posts for insert to authenticated
with check (
  author_id = auth.uid()
  and moderation_status = 'visible'
  and public.community_can_participate()
  and public.is_feature_enabled('community_posts_enabled')
  and (group_id is null or public.community_is_group_member(group_id))
);
create policy "Authors update own community posts"
on public.community_posts for update to authenticated
using (
  author_id = auth.uid()
  and moderation_status = 'visible'
  and public.community_can_participate()
  and public.is_feature_enabled('community_posts_enabled')
)
with check (
  author_id = auth.uid()
  and moderation_status = 'visible'
  and public.community_can_participate()
  and public.is_feature_enabled('community_posts_enabled')
  and (group_id is null or public.community_is_group_member(group_id))
);
create policy "Authors delete own community posts"
on public.community_posts for delete to authenticated
using (author_id = auth.uid() and public.community_can_participate());

create policy "Learners read visible accessible comments"
on public.community_comments for select to authenticated
using (
  moderation_status = 'visible'
  and public.community_can_read_comment(id)
);
create policy "Community moderators read comments"
on public.community_comments for select to authenticated
using (public.has_platform_authority());
create policy "Learners create accessible comments"
on public.community_comments for insert to authenticated
with check (
  author_id = auth.uid()
  and moderation_status = 'visible'
  and public.community_can_participate()
  and public.is_feature_enabled('community_posts_enabled')
  and (
    (post_id is not null and public.community_can_read_post(post_id))
    or (answer_id is not null and public.community_can_read_answer(answer_id))
  )
  and (parent_comment_id is null or public.community_can_read_comment(parent_comment_id))
  and not exists (
    select 1
    from public.community_posts p
    where p.id = post_id
      and public.community_is_blocked(p.author_id)
  )
  and not exists (
    select 1
    from public.community_answers a
    where a.id = answer_id
      and public.community_is_blocked(a.author_id)
  )
);
create policy "Authors update own comments"
on public.community_comments for update to authenticated
using (author_id = auth.uid() and moderation_status = 'visible' and public.community_can_participate())
with check (
  author_id = auth.uid()
  and moderation_status = 'visible'
  and public.community_can_participate()
  and public.is_feature_enabled('community_posts_enabled')
);
create policy "Authors delete own comments"
on public.community_comments for delete to authenticated
using (author_id = auth.uid() and public.community_can_participate());

create policy "Learners read accessible post reactions"
on public.community_reactions for select to authenticated
using (public.community_can_read_post(post_id));
create policy "Learners react to accessible posts"
on public.community_reactions for insert to authenticated
with check (
  user_id = auth.uid()
  and public.community_can_participate()
  and public.is_feature_enabled('community_posts_enabled')
  and public.community_can_read_post(post_id)
);
create policy "Learners remove own reactions"
on public.community_reactions for delete to authenticated
using (user_id = auth.uid() and public.community_can_participate());

create policy "Learners read accessible questions"
on public.community_questions for select to authenticated
using (
  moderation_status = 'visible'
  and public.community_can_participate()
  and public.is_feature_enabled('community_questions_enabled')
  and public.community_is_active_learner(author_id)
  and not public.community_is_blocked(author_id)
  and (group_id is null or public.community_is_group_member(group_id))
);
create policy "Community moderators read questions"
on public.community_questions for select to authenticated
using (public.has_platform_authority());
create policy "Learners create questions"
on public.community_questions for insert to authenticated
with check (
  author_id = auth.uid()
  and moderation_status = 'visible'
  and question_status = 'open'
  and accepted_answer_id is null
  and public.community_can_participate()
  and public.is_feature_enabled('community_questions_enabled')
  and (group_id is null or public.community_is_group_member(group_id))
);
create policy "Authors update own open questions"
on public.community_questions for update to authenticated
using (
  author_id = auth.uid()
  and question_status = 'open'
  and accepted_answer_id is null
  and moderation_status = 'visible'
  and public.community_can_participate()
)
with check (
  author_id = auth.uid()
  and moderation_status = 'visible'
  and question_status = 'open'
  and accepted_answer_id is null
  and public.community_can_participate()
  and public.is_feature_enabled('community_questions_enabled')
  and (group_id is null or public.community_is_group_member(group_id))
);
create policy "Authors delete own questions"
on public.community_questions for delete to authenticated
using (author_id = auth.uid() and public.community_can_participate());

create policy "Learners read accessible answers"
on public.community_answers for select to authenticated
using (
  moderation_status = 'visible'
  and public.community_can_read_question(question_id)
  and public.community_is_active_learner(author_id)
  and not public.community_is_blocked(author_id)
);
create policy "Community moderators read answers"
on public.community_answers for select to authenticated
using (public.has_platform_authority());
create policy "Learners answer accessible questions"
on public.community_answers for insert to authenticated
with check (
  author_id = auth.uid()
  and moderation_status = 'visible'
  and public.community_can_participate()
  and public.is_feature_enabled('community_questions_enabled')
  and public.community_can_read_question(question_id)
);
create policy "Authors update own answers"
on public.community_answers for update to authenticated
using (author_id = auth.uid() and moderation_status = 'visible' and public.community_can_participate())
with check (
  author_id = auth.uid()
  and moderation_status = 'visible'
  and public.community_can_participate()
  and public.is_feature_enabled('community_questions_enabled')
  and public.community_can_read_question(question_id)
);
create policy "Authors delete own answers"
on public.community_answers for delete to authenticated
using (author_id = auth.uid() and public.community_can_participate());

create policy "Learners read study group directory"
on public.study_groups for select to authenticated
using (
  public.community_can_participate()
  and public.is_feature_enabled('study_groups_enabled')
  and public.community_is_active_learner(created_by)
  and not public.community_is_blocked(created_by)
);
create policy "Community moderators read study groups"
on public.study_groups for select to authenticated
using (public.has_platform_authority());
create policy "Learners create study groups"
on public.study_groups for insert to authenticated
with check (
  created_by = auth.uid()
  and public.community_can_participate()
  and public.is_feature_enabled('study_groups_enabled')
);
create policy "Group admins update their group"
on public.study_groups for update to authenticated
using (
  public.community_is_group_admin(id)
  and public.community_can_participate()
  and public.is_feature_enabled('study_groups_enabled')
)
with check (
  public.community_is_group_admin(id)
  and public.community_can_participate()
  and public.is_feature_enabled('study_groups_enabled')
);
create policy "Group admins delete their group"
on public.study_groups for delete to authenticated
using (public.community_is_group_admin(id) and public.community_can_participate());

create policy "Learners read own or active group memberships"
on public.study_group_members for select to authenticated
using (
  public.community_can_participate()
  and public.is_feature_enabled('study_groups_enabled')
  and public.community_is_active_learner(user_id)
  and (
    user_id = auth.uid()
    or public.community_is_group_admin(group_id)
    or (
      membership_status = 'active'
      and public.community_is_group_member(group_id)
      and public.community_is_active_learner(user_id)
    )
  )
);
create policy "Learners request or join study groups"
on public.study_group_members for insert to authenticated
with check (
  user_id = auth.uid()
  and member_role = 'member'
  and public.community_can_participate()
  and public.is_feature_enabled('study_groups_enabled')
  and exists (
    select 1 from public.study_groups g
    where g.id = group_id
      and (
        (g.visibility = 'public' and membership_status = 'active')
        or (g.visibility = 'private' and membership_status = 'pending')
      )
      and public.community_is_active_learner(g.created_by)
      and not public.community_is_blocked(g.created_by)
  )
);
create policy "Members leave study groups"
on public.study_group_members for delete to authenticated
using (
  user_id = auth.uid()
  and member_role = 'member'
  and membership_status = 'active'
  and public.community_can_participate()
  and public.is_feature_enabled('study_groups_enabled')
);

create policy "Learners read own notifications"
on public.community_notifications for select to authenticated
using (
  recipient_id = auth.uid()
  and public.community_can_participate()
  and public.is_feature_enabled('community_notifications_enabled')
);
create policy "Learners mark own notifications read"
on public.community_notifications for update to authenticated
using (
  recipient_id = auth.uid()
  and public.community_can_participate()
  and public.is_feature_enabled('community_notifications_enabled')
)
with check (
  recipient_id = auth.uid()
  and public.community_can_participate()
  and public.is_feature_enabled('community_notifications_enabled')
);

create policy "Learners read own reports and moderators read report queue"
on public.community_reports for select to authenticated
using (reported_by = auth.uid() or public.has_platform_authority());
create policy "Learners report other community content"
on public.community_reports for insert to authenticated
with check (
  reported_by = auth.uid()
  and report_status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and public.community_can_participate()
  and public.is_feature_enabled('community_enabled')
);

create policy "Learners read own community blocks"
on public.community_blocks for select to authenticated
using (blocker_id = auth.uid() and public.community_can_participate());
create policy "Learners block other community members"
on public.community_blocks for insert to authenticated
with check (
  blocker_id = auth.uid()
  and public.community_can_participate()
  and public.is_feature_enabled('community_enabled')
  and public.is_account_active(blocked_id)
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = blocked_id
      and ur.role = 'learner'
      and ur.revoked_at is null
  )
);
create policy "Learners unblock members"
on public.community_blocks for delete to authenticated
using (blocker_id = auth.uid() and public.community_can_participate());

revoke all on public.community_profiles,
  public.community_posts,
  public.community_comments,
  public.community_reactions,
  public.community_questions,
  public.community_answers,
  public.study_groups,
  public.study_group_members,
  public.community_notifications,
  public.community_reports,
  public.community_blocks
from public, anon, authenticated;

grant select on public.community_profiles to authenticated;
grant insert (user_id, display_name, avatar_url, biography, learning_interests, subjects, profile_visible, show_achievements)
  on public.community_profiles to authenticated;
grant update (display_name, avatar_url, biography, learning_interests, subjects, profile_visible, show_achievements)
  on public.community_profiles to authenticated;

grant select, delete on public.community_posts to authenticated;
grant insert (author_id, group_id, post_type, body) on public.community_posts to authenticated;
grant update (body, post_type, group_id) on public.community_posts to authenticated;
grant select, delete on public.community_comments to authenticated;
grant insert (author_id, post_id, answer_id, parent_comment_id, body)
  on public.community_comments to authenticated;
grant update (body) on public.community_comments to authenticated;
grant select, delete on public.community_reactions to authenticated;
grant insert (post_id, user_id, reaction_type) on public.community_reactions to authenticated;
grant select, delete on public.community_questions to authenticated;
grant insert (author_id, group_id, title, body, subject, topic)
  on public.community_questions to authenticated;
grant update (title, body, subject, topic) on public.community_questions to authenticated;
grant select, delete on public.community_answers to authenticated;
grant insert (question_id, author_id, body) on public.community_answers to authenticated;
grant update (body) on public.community_answers to authenticated;
grant select, delete on public.study_groups to authenticated;
grant insert (created_by, name, description, subject, visibility)
  on public.study_groups to authenticated;
grant update (name, description, subject, visibility) on public.study_groups to authenticated;
grant select on public.study_group_members to authenticated;
grant insert (group_id, user_id, membership_status), delete on public.study_group_members to authenticated;
grant select on public.community_notifications to authenticated;
grant update (read_at) on public.community_notifications to authenticated;
grant select on public.community_reports to authenticated;
grant insert (reported_by, target_type, target_id, reason)
  on public.community_reports to authenticated;
grant select, delete on public.community_blocks to authenticated;
grant insert (blocker_id, blocked_id) on public.community_blocks to authenticated;

revoke execute on function public.community_can_participate() from public, anon;
revoke execute on function public.community_post_statistics(uuid[]) from public, anon;
revoke execute on function public.community_group_statistics(uuid[]) from public, anon;
revoke execute on function public.community_visible_badges(uuid) from public, anon;
revoke execute on function public.community_is_blocked(uuid) from public, anon;
revoke execute on function public.community_is_active_learner(uuid) from public, anon;
revoke execute on function public.community_is_group_member(uuid) from public, anon;
revoke execute on function public.community_is_group_admin(uuid) from public, anon;
revoke execute on function public.community_can_read_post(uuid) from public, anon;
revoke execute on function public.community_can_read_question(uuid) from public, anon;
revoke execute on function public.community_can_read_answer(uuid) from public, anon;
revoke execute on function public.community_can_read_comment(uuid) from public, anon;
revoke execute on function public.community_validate_text() from public, anon, authenticated;
revoke execute on function public.community_set_updated_at() from public, anon, authenticated;
revoke execute on function public.community_rate_limit() from public, anon, authenticated;
revoke execute on function public.community_validate_comment_parent() from public, anon, authenticated;
revoke execute on function public.community_validate_report() from public, anon, authenticated;
revoke execute on function public.community_create_group_admin() from public, anon, authenticated;
revoke execute on function public.community_notify(uuid, uuid, text, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.community_notify_comment() from public, anon, authenticated;
revoke execute on function public.community_notify_reaction() from public, anon, authenticated;
revoke execute on function public.community_notify_answer() from public, anon, authenticated;
revoke execute on function public.community_notify_group_request() from public, anon, authenticated;
revoke execute on function public.community_accept_answer(uuid, uuid) from public, anon;
grant execute on function public.community_can_participate() to authenticated;
grant execute on function public.community_post_statistics(uuid[]) to authenticated;
grant execute on function public.community_group_statistics(uuid[]) to authenticated;
grant execute on function public.community_visible_badges(uuid) to authenticated;
grant execute on function public.community_is_blocked(uuid) to authenticated;
grant execute on function public.community_is_active_learner(uuid) to authenticated;
grant execute on function public.community_is_group_member(uuid) to authenticated;
grant execute on function public.community_is_group_admin(uuid) to authenticated;
grant execute on function public.community_can_read_post(uuid) to authenticated;
grant execute on function public.community_can_read_question(uuid) to authenticated;
grant execute on function public.community_can_read_answer(uuid) to authenticated;
grant execute on function public.community_can_read_comment(uuid) to authenticated;
grant execute on function public.community_accept_answer(uuid, uuid) to authenticated;

revoke execute on function public.community_review_group_request(uuid, boolean) from public, anon;
grant execute on function public.community_review_group_request(uuid, boolean) to authenticated;
revoke execute on function public.community_join_group(uuid) from public, anon;
grant execute on function public.community_join_group(uuid) to authenticated;
revoke execute on function public.owner_moderate_community_report(uuid, text, boolean, text) from public, anon;
grant execute on function public.owner_moderate_community_report(uuid, text, boolean, text) to authenticated;
revoke execute on function public.owner_set_community_suspension(uuid, boolean, integer) from public, anon;
grant execute on function public.owner_set_community_suspension(uuid, boolean, integer) to authenticated;
revoke execute on function public.owner_community_overview() from public, anon;
grant execute on function public.owner_community_overview() to authenticated;
revoke execute on function public.owner_list_community_learners(integer, text) from public, anon;
grant execute on function public.owner_list_community_learners(integer, text) to authenticated;
