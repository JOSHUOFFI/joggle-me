import "server-only";
import { z } from "zod";
import type { DatabaseClient } from "@/lib/supabase/types";
import { logger } from "@/lib/logger";
import { getFeatureSnapshot } from "@/lib/features";

const postRowSchema = z.object({
  id: z.uuid(),
  author_id: z.uuid(),
  group_id: z.uuid().nullable(),
  post_type: z.enum(["discussion", "study_tip", "achievement"]),
  body: z.string(),
  created_at: z.iso.datetime({ offset: true }),
});

const commentRowSchema = z.object({
  id: z.uuid(),
  author_id: z.uuid(),
  post_id: z.uuid().nullable(),
  answer_id: z.uuid().nullable(),
  parent_comment_id: z.uuid().nullable(),
  body: z.string(),
  created_at: z.iso.datetime({ offset: true }),
});

const profileRowSchema = z.object({
  user_id: z.uuid(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  biography: z.string(),
  learning_interests: z.array(z.string()),
  subjects: z.array(z.string()),
  profile_visible: z.boolean(),
  show_achievements: z.boolean(),
});

const postStatSchema = z.object({
  post_id: z.uuid(),
  reaction_count: z.number().int().nonnegative(),
  comment_count: z.number().int().nonnegative(),
  reacted_by_me: z.boolean(),
});

const questionRowSchema = z.object({
  id: z.uuid(),
  author_id: z.uuid(),
  group_id: z.uuid().nullable(),
  title: z.string(),
  body: z.string(),
  subject: z.string(),
  topic: z.string(),
  question_status: z.enum(["open", "answered", "closed"]),
  accepted_answer_id: z.uuid().nullable(),
  created_at: z.iso.datetime({ offset: true }),
});

const answerRowSchema = z.object({
  id: z.uuid(),
  question_id: z.uuid(),
  author_id: z.uuid(),
  body: z.string(),
  created_at: z.iso.datetime({ offset: true }),
});

const groupRowSchema = z.object({
  id: z.uuid(),
  created_by: z.uuid(),
  name: z.string(),
  description: z.string(),
  subject: z.string(),
  visibility: z.enum(["public", "private"]),
  created_at: z.iso.datetime({ offset: true }),
});

const groupStatSchema = z.object({
  group_id: z.uuid(),
  member_count: z.number().int().nonnegative(),
  my_status: z.enum(["pending", "active", "rejected"]).nullable(),
  is_admin: z.boolean(),
});

const groupMemberSchema = z.object({
  id: z.uuid(),
  group_id: z.uuid(),
  user_id: z.uuid(),
  member_role: z.enum(["admin", "member"]),
  membership_status: z.enum(["pending", "active", "rejected"]),
  created_at: z.iso.datetime({ offset: true }),
});

const notificationRowSchema = z.object({
  id: z.uuid(),
  actor_id: z.uuid(),
  event_type: z.enum([
    "post_comment",
    "comment_reply",
    "answer_comment",
    "question_answer",
    "post_reaction",
    "group_request",
    "group_approved",
    "group_rejected",
  ]),
  target_type: z.enum(["post", "comment", "answer", "question", "study_group"]),
  target_id: z.uuid(),
  created_at: z.iso.datetime({ offset: true }),
  read_at: z.iso.datetime({ offset: true }).nullable(),
});

export type CommunityFeatures = Record<
  | "community_enabled"
  | "community_posts_enabled"
  | "community_questions_enabled"
  | "study_groups_enabled"
  | "community_notifications_enabled",
  boolean
>;

export class CommunityDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommunityDataError";
  }
}

function fail(message: string, code?: string | null): never {
  logger.error("Community data could not be loaded", { code: code ?? null });
  throw new CommunityDataError(message);
}

async function assertCommunityParticipation(
  supabase: DatabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("community_profiles")
    .select("community_suspended_until")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail("Community participation could not be verified.", error.code);
  if (
    data?.community_suspended_until &&
    Date.parse(data.community_suspended_until) > Date.now()
  ) fail("Community participation is currently unavailable.");
}

async function loadVisibleProfiles(supabase: DatabaseClient, userIds: string[]) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return new Map<string, z.infer<typeof profileRowSchema>>();
  const { data, error } = await supabase
    .from("community_profiles")
    .select("user_id,display_name,avatar_url,biography,learning_interests,subjects,profile_visible,show_achievements")
    .in("user_id", ids);
  if (error) fail("Community profiles could not be loaded.", error.code);
  const parsed = z.array(profileRowSchema).safeParse(data);
  if (!parsed.success) fail("Community profile data failed validation.");
  return new Map(parsed.data.map((profile) => [profile.user_id, profile]));
}

async function loadActiveLearnerIds(supabase: DatabaseClient, userIds: string[]) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return new Set<string>();
  const { data, error } = await supabase
    .from("guest_workspaces")
    .select("id")
    .in("id", ids)
    .gt("expires_at", new Date().toISOString());
  if (error) fail("Active community member status could not be verified.", error.code);
  return new Set((data ?? []).map((row) => row.id));
}

export async function loadCommunityFeed(
  supabase: DatabaseClient,
  userId: string,
  guestTokenHash: string,
  page: number,
  groupId?: string,
) {
  await assertCommunityParticipation(supabase, userId);
  const safePage = Math.max(1, Math.min(1000, Math.floor(page)));
  const { data, error } = await supabase.rpc("guest_list_community_posts", {
    p_token_hash: guestTokenHash,
    p_page: safePage,
    p_group_id: groupId ?? null,
  });
  if (error) fail("The community feed could not be loaded.", error.code);
  const parsedPosts = z.array(postRowSchema).safeParse(data);
  if (!parsedPosts.success) fail("Community posts failed validation.");
  const posts = parsedPosts.data.slice(0, 20);
  if (!posts.length) return { posts: [], page: safePage, hasMore: false };

  const postIds = posts.map((post) => post.id);
  const [statsResult, commentsResult] = await Promise.all([
    supabase.rpc("guest_community_post_statistics", {
      p_token_hash: guestTokenHash,
      p_post_ids: postIds,
    }),
    supabase.rpc("guest_list_post_comments", {
      p_token_hash: guestTokenHash,
      p_post_ids: postIds,
    }),
  ]);
  if (statsResult.error) fail("Post reaction and comment totals could not be loaded.", statsResult.error.code);
  if (commentsResult.error) fail("Post comments could not be loaded.", commentsResult.error.code);
  const parsedStats = z.array(postStatSchema).safeParse(statsResult.data);
  const parsedComments = z.array(commentRowSchema).safeParse(commentsResult.data);
  if (!parsedStats.success || !parsedComments.success) {
    fail("Community feed details failed validation.");
  }
  const statsByPost = new Map(parsedStats.data.map((item) => [item.post_id, item]));
  if (statsByPost.size !== posts.length) fail("Some community post totals were unavailable.");
  const commentsByPost = new Map<string, z.infer<typeof commentRowSchema>[]>();
  for (const comment of parsedComments.data) {
    if (!comment.post_id) continue;
    const list = commentsByPost.get(comment.post_id) ?? [];
    if (list.length < 4) list.push(comment);
    commentsByPost.set(comment.post_id, list);
  }
  const profileMap = await loadVisibleProfiles(supabase, [
    ...posts.map((post) => post.author_id),
    ...parsedComments.data.map((comment) => comment.author_id),
  ]);
  const author = (id: string) => {
    const profile = profileMap.get(id);
    return {
      displayName: profile?.profile_visible || id === userId
        ? profile?.display_name ?? "Learner"
        : "Learner",
      avatarUrl: profile?.profile_visible || id === userId ? profile?.avatar_url ?? null : null,
      profileHref: profile?.profile_visible
        ? `/dashboard/community/learners/${id}`
        : null,
    };
  };
  return {
    page: safePage,
    hasMore: parsedPosts.data.length > 20,
    posts: posts.map((post) => ({
      ...post,
      author: author(post.author_id),
      stats: statsByPost.get(post.id)!,
      comments: (commentsByPost.get(post.id) ?? []).map((comment) => ({
        ...comment,
        author: author(comment.author_id),
      })),
    })),
  };
}

export async function loadCommunityQuestions(
  supabase: DatabaseClient,
  userId: string,
  guestTokenHash: string,
  filters: { subject?: string; topic?: string; status?: string; search?: string },
) {
  await assertCommunityParticipation(supabase, userId);
  const { data, error } = await supabase.rpc("guest_list_community_questions", {
    p_token_hash: guestTokenHash,
    p_subject: filters.subject ?? null,
    p_topic: filters.topic?.replace(/[%_]/g, "") ?? null,
    p_status: ["open", "answered", "closed"].includes(filters.status ?? "")
      ? filters.status
      : null,
    p_search: filters.search?.replace(/[%_,]/g, " ").trim() ?? null,
  });
  if (error) fail("Questions could not be loaded.", error.code);
  const parsedQuestions = z.array(questionRowSchema).safeParse(data);
  if (!parsedQuestions.success) fail("Community questions failed validation.");
  const questions = parsedQuestions.data;
  if (!questions.length) return [];

  const questionIds = questions.map((question) => question.id);
  const { data: answerData, error: answerError } = await supabase.rpc(
    "guest_list_question_answers",
    {
      p_token_hash: guestTokenHash,
      p_question_ids: questionIds,
    },
  );
  if (answerError) fail("Question answers could not be loaded.", answerError.code);
  const parsedAnswers = z.array(answerRowSchema).safeParse(answerData);
  if (!parsedAnswers.success) fail("Question answers failed validation.");
  const answerIds = parsedAnswers.data.map((answer) => answer.id);
  const { data: commentData, error: commentError } = answerIds.length
    ? await supabase.rpc("guest_list_answer_comments", {
        p_token_hash: guestTokenHash,
        p_answer_ids: answerIds,
      })
    : { data: [], error: null };
  if (commentError) fail("Answer comments could not be loaded.", commentError.code);
  const parsedComments = z.array(commentRowSchema).safeParse(commentData);
  if (!parsedComments.success) fail("Answer comments failed validation.");
  const profileMap = await loadVisibleProfiles(supabase, [
    ...questions.map((question) => question.author_id),
    ...parsedAnswers.data.map((answer) => answer.author_id),
    ...parsedComments.data.map((comment) => comment.author_id),
  ]);
  const author = (id: string) => {
    const profile = profileMap.get(id);
    return {
      displayName: profile?.profile_visible || id === userId
        ? profile?.display_name ?? "Learner"
        : "Learner",
      avatarUrl: profile?.profile_visible || id === userId ? profile?.avatar_url ?? null : null,
      profileHref: profile?.profile_visible
        ? `/dashboard/community/learners/${id}`
        : null,
    };
  };
  const answersByQuestion = new Map<string, typeof parsedAnswers.data>();
  for (const answer of parsedAnswers.data) {
    const list = answersByQuestion.get(answer.question_id) ?? [];
    if (list.length < 10) list.push(answer);
    answersByQuestion.set(answer.question_id, list);
  }
  const commentsByAnswer = new Map<string, typeof parsedComments.data>();
  for (const comment of parsedComments.data) {
    if (!comment.answer_id) continue;
    const list = commentsByAnswer.get(comment.answer_id) ?? [];
    if (list.length < 3) list.push(comment);
    commentsByAnswer.set(comment.answer_id, list);
  }
  return questions.map((question) => ({
    ...question,
    author: author(question.author_id),
    answers: (answersByQuestion.get(question.id) ?? []).map((answer) => ({
      ...answer,
      author: author(answer.author_id),
      comments: (commentsByAnswer.get(answer.id) ?? []).map((comment) => ({
        ...comment,
        author: author(comment.author_id),
      })),
    })),
  }));
}

export async function loadStudyGroups(
  supabase: DatabaseClient,
  userId: string,
  guestTokenHash: string,
) {
  await assertCommunityParticipation(supabase, userId);
  const { data, error } = await supabase.rpc("guest_list_study_groups", {
    p_token_hash: guestTokenHash,
  });
  if (error) fail("Study groups could not be loaded.", error.code);
  const parsedGroups = z.array(groupRowSchema).safeParse(data);
  if (!parsedGroups.success) fail("Study group data failed validation.");
  if (!parsedGroups.data.length) return { groups: [], requests: [], members: [] };
  const groupIds = parsedGroups.data.map((group) => group.id);
  const statsResult = await supabase.rpc("guest_community_group_statistics", {
    p_token_hash: guestTokenHash,
    p_group_ids: groupIds,
  });
  if (statsResult.error) fail("Study group membership totals could not be loaded.", statsResult.error.code);
  const parsedStats = z.array(groupStatSchema).safeParse(statsResult.data);
  if (!parsedStats.success || parsedStats.data.length !== parsedGroups.data.length) {
    fail("Study group membership totals failed validation.");
  }
  const stats = new Map(parsedStats.data.map((item) => [item.group_id, item]));
  const adminGroupIds = parsedGroups.data
    .filter((group) => group.created_by === userId || stats.get(group.id)?.is_admin)
    .map((group) => group.id);
  const memberGroupIds = parsedGroups.data
    .filter((group) => stats.get(group.id)?.my_status === "active")
    .map((group) => group.id);
  const [requestResult, memberResult] = await Promise.all([
    adminGroupIds.length
      ? supabase
      .from("study_group_members")
      .select("id,group_id,user_id,member_role,membership_status,created_at")
      .in("group_id", adminGroupIds)
      .eq("membership_status", "pending")
      .limit(100)
      : Promise.resolve({ data: [], error: null }),
    memberGroupIds.length
      ? supabase
      .from("study_group_members")
      .select("id,group_id,user_id,member_role,membership_status,created_at")
      .in("group_id", memberGroupIds)
      .eq("membership_status", "active")
      .limit(100)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (requestResult.error || memberResult.error) {
    fail("Study group members could not be loaded.", requestResult.error?.code ?? memberResult.error?.code);
  }
  const parsedRequests = z.array(groupMemberSchema).safeParse(requestResult.data);
  const parsedMembers = z.array(groupMemberSchema).safeParse(memberResult.data);
  if (!parsedRequests.success || !parsedMembers.success) fail("Study group members failed validation.");
  const activeLearners = await loadActiveLearnerIds(supabase, [
    ...parsedRequests.data.map((member) => member.user_id),
    ...parsedMembers.data.map((member) => member.user_id),
  ]);
  const requests = parsedRequests.data.filter((member) =>
    activeLearners.has(member.user_id)
  );
  const members = parsedMembers.data.filter((member) =>
    activeLearners.has(member.user_id)
  );
  const userIds = [...members, ...requests].map((member) => member.user_id);
  const profileMap = await loadVisibleProfiles(supabase, userIds);
  const memberDto = (member: z.infer<typeof groupMemberSchema>) => ({
    ...member,
    displayName:
      profileMap.get(member.user_id)?.profile_visible || member.user_id === userId
        ? profileMap.get(member.user_id)?.display_name ?? "Learner"
        : "Learner",
    profileHref: profileMap.get(member.user_id)?.profile_visible
      ? `/dashboard/community/learners/${member.user_id}`
      : null,
  });
  return {
    groups: parsedGroups.data.map((group) => ({
      ...group,
      stats: stats.get(group.id)!,
    })),
    requests: requests.map(memberDto),
    members: members.map(memberDto),
  };
}

export async function loadStudyGroupDetail(
  supabase: DatabaseClient,
  userId: string,
  guestTokenHash: string,
  groupId: string,
) {
  await assertCommunityParticipation(supabase, userId);
  const { data, error } = await supabase.rpc("guest_get_study_group", {
    p_token_hash: guestTokenHash,
    p_group_id: groupId,
  });
  if (error) fail("The study group could not be loaded.", error.code);
  if (!data || (Array.isArray(data) && !data.length)) return null;
  const parsedGroup = groupRowSchema.safeParse(
    Array.isArray(data) ? data[0] ?? null : data,
  );
  if (!parsedGroup.success) fail("Study group data failed validation.");
  const statsResult = await supabase.rpc("guest_community_group_statistics", {
    p_token_hash: guestTokenHash,
    p_group_ids: [groupId],
  });
  if (statsResult.error) fail("Study group membership totals could not be loaded.", statsResult.error.code);
  const parsedStats = z.array(groupStatSchema).safeParse(statsResult.data);
  if (!parsedStats.success || parsedStats.data.length !== 1) {
    fail("Study group membership totals failed validation.");
  }
  const [requestResult, memberResult] = await Promise.all([
    parsedStats.data[0].is_admin
      ? supabase
      .from("study_group_members")
      .select("id,group_id,user_id,member_role,membership_status,created_at")
      .eq("group_id", groupId)
      .eq("membership_status", "pending")
      .limit(100)
      : Promise.resolve({ data: [], error: null }),
    parsedStats.data[0].my_status === "active"
      ? supabase
      .from("study_group_members")
      .select("id,group_id,user_id,member_role,membership_status,created_at")
      .eq("group_id", groupId)
      .eq("membership_status", "active")
      .limit(100)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (requestResult.error || memberResult.error) {
    fail("Study group members could not be loaded.", requestResult.error?.code ?? memberResult.error?.code);
  }
  const parsedRequests = z.array(groupMemberSchema).safeParse(requestResult.data);
  const parsedMembers = z.array(groupMemberSchema).safeParse(memberResult.data);
  if (!parsedRequests.success || !parsedMembers.success) fail("Study group members failed validation.");
  const activeLearners = await loadActiveLearnerIds(supabase, [
    ...parsedRequests.data.map((member) => member.user_id),
    ...parsedMembers.data.map((member) => member.user_id),
  ]);
  const requests = parsedRequests.data.filter((member) =>
    activeLearners.has(member.user_id)
  );
  const members = parsedMembers.data.filter((member) =>
    activeLearners.has(member.user_id)
  );
  const profiles = await loadVisibleProfiles(supabase, [
    ...requests.map((member) => member.user_id),
    ...members.map((member) => member.user_id),
  ]);
  const memberDto = (member: z.infer<typeof groupMemberSchema>) => ({
    id: member.id,
    role: member.member_role,
    status: member.membership_status,
    userId: member.user_id,
    displayName:
      profiles.get(member.user_id)?.profile_visible || member.user_id === userId
        ? profiles.get(member.user_id)?.display_name ?? "Learner"
        : "Learner",
    profileHref: profiles.get(member.user_id)?.profile_visible
      ? `/dashboard/community/learners/${member.user_id}`
      : null,
  });
  return {
    group: parsedGroup.data,
    stats: parsedStats.data[0],
    requests: requests.map(memberDto),
    members: members.map(memberDto),
  };
}

export async function loadCommunityFeatures(): Promise<CommunityFeatures> {
  return getFeatureSnapshot() as CommunityFeatures;
}

export async function loadCommunityNotifications(
  supabase: DatabaseClient,
  userId: string,
) {
  await assertCommunityParticipation(supabase, userId);
  const { data, error } = await supabase
    .from("community_notifications")
    .select("id,actor_id,event_type,target_type,target_id,created_at,read_at")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) fail("Community notifications could not be loaded.", error.code);
  const parsed = z.array(notificationRowSchema).safeParse(data);
  if (!parsed.success) fail("Community notifications failed validation.");
  const profiles = await loadVisibleProfiles(
    supabase,
    parsed.data.map((notification) => notification.actor_id),
  );
  return parsed.data.map((notification) => {
    const profile = profiles.get(notification.actor_id);
    return {
      ...notification,
      actorName: profile?.profile_visible ? profile.display_name : "A learner",
    };
  });
}

export async function loadCommunityBlocks(supabase: DatabaseClient, userId: string) {
  await assertCommunityParticipation(supabase, userId);
  const { data, error } = await supabase
    .from("community_blocks")
    .select("blocked_id,created_at")
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) fail("Blocked community members could not be loaded.", error.code);
  const schema = z.array(z.object({
    blocked_id: z.uuid(),
    created_at: z.iso.datetime({ offset: true }),
  }));
  const parsed = schema.safeParse(data);
  if (!parsed.success) fail("Blocked community member data failed validation.");
  const profiles = await loadVisibleProfiles(
    supabase,
    parsed.data.map((block) => block.blocked_id),
  );
  return parsed.data.map((block) => ({
    ...block,
    displayName: profiles.get(block.blocked_id)?.profile_visible
      ? profiles.get(block.blocked_id)!.display_name
      : "Learner",
  }));
}

export async function loadOwnCommunityProfile(supabase: DatabaseClient, userId: string) {
  await assertCommunityParticipation(supabase, userId);
  const { data, error } = await supabase
    .from("community_profiles")
    .select("user_id,display_name,avatar_url,biography,learning_interests,subjects,profile_visible,show_achievements")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail("Community profile settings could not be loaded.", error.code);
  if (!data) return null;
  const parsed = profileRowSchema.safeParse(data);
  if (!parsed.success) fail("Community profile settings failed validation.");
  return parsed.data;
}

export async function loadPublicCommunityProfile(
  supabase: DatabaseClient,
  viewerId: string,
  guestTokenHash: string,
  userId: string,
) {
  await assertCommunityParticipation(supabase, viewerId);
  const { data, error } = await supabase
    .from("community_profiles")
    .select("user_id,display_name,avatar_url,biography,learning_interests,subjects,profile_visible,show_achievements")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail("The community profile could not be loaded.", error.code);
  if (!data) return null;
  const parsed = profileRowSchema.safeParse(data);
  if (!parsed.success || !parsed.data.profile_visible) {
    fail("Community profile data failed validation.");
  }
  const activeLearners = await loadActiveLearnerIds(supabase, [userId]);
  if (!activeLearners.has(userId)) return null;
  const [outgoingBlock, incomingBlock] = await Promise.all([
    supabase
      .from("community_blocks")
      .select("blocker_id")
      .eq("blocker_id", viewerId)
      .eq("blocked_id", userId)
      .maybeSingle(),
    supabase
      .from("community_blocks")
      .select("blocker_id")
      .eq("blocker_id", userId)
      .eq("blocked_id", viewerId)
      .maybeSingle(),
  ]);
  if (outgoingBlock.error || incomingBlock.error) {
    fail(
      "Community profile access could not be verified.",
      outgoingBlock.error?.code ?? incomingBlock.error?.code,
    );
  }
  if (outgoingBlock.data || incomingBlock.data) return null;
  if (!parsed.data.show_achievements) return { ...parsed.data, badges: [] };
  const { data: badgeData, error: badgeError } = await supabase.rpc(
    "guest_community_visible_badges",
    {
      p_token_hash: guestTokenHash,
      p_user_id: userId,
    },
  );
  if (badgeError) fail("Public learner achievements could not be loaded.", badgeError.code);
  const badgeSchema = z.array(z.object({
    badge_key: z.enum([
      "first_steps",
      "quiz_champion",
      "consistent_learner",
      "perfect_score",
      "dedicated_learner",
      "knowledge_seeker",
    ]),
    awarded_at: z.iso.datetime({ offset: true }),
  }));
  const badges = badgeSchema.safeParse(badgeData);
  if (!badges.success) fail("Public learner achievements failed validation.");
  return { ...parsed.data, badges: badges.data };
}
