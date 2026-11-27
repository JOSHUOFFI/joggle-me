import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

const postRowSchema = z.object({
  id: z.uuid(),
  author_id: z.uuid(),
  group_id: z.uuid().nullable(),
  post_type: z.enum(["discussion", "study_tip", "achievement"]),
  body: z.string(),
  created_at: z.iso.datetime({ offset: true }),
});

const reportRowSchema = z.object({
  id: z.uuid(),
  reported_by: z.uuid(),
  target_type: z.enum(["post", "comment", "question", "answer"]),
  target_id: z.uuid(),
  reason: z.string(),
  created_at: z.iso.datetime({ offset: true }),
});

const moderationTextSchema = z.object({
  id: z.uuid(),
  author_id: z.uuid(),
  body: z.string().optional(),
  title: z.string().optional(),
});

const ownerOverviewSchema = z.object({
  visible_posts: z.number().int().nonnegative(),
  visible_questions: z.number().int().nonnegative(),
  study_groups: z.number().int().nonnegative(),
  active_memberships: z.number().int().nonnegative(),
  pending_reports: z.number().int().nonnegative(),
  suspended_learners: z.number().int().nonnegative(),
});

const ownerLearnerSchema = z.object({
  user_id: z.uuid(),
  display_name: z.string(),
  community_suspended_until: z.iso.datetime({ offset: true }).nullable(),
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

const featureKeys = [
  "community_enabled",
  "community_posts_enabled",
  "community_questions_enabled",
  "study_groups_enabled",
  "community_notifications_enabled",
] as const;

export type CommunityFeatures = Record<(typeof featureKeys)[number], boolean>;

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

async function loadVisibleProfiles(supabase: SupabaseClient, userIds: string[]) {
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

export async function loadCommunityFeed(
  supabase: SupabaseClient,
  userId: string,
  page: number,
  groupId?: string,
) {
  const safePage = Math.max(1, Math.min(1000, Math.floor(page)));
  const start = (safePage - 1) * 20;
  let feedQuery = supabase
    .from("community_posts")
    .select("id,author_id,group_id,post_type,body,created_at")
    .eq("moderation_status", "visible")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (groupId) feedQuery = feedQuery.eq("group_id", groupId);
  const { data, error } = await feedQuery.range(start, start + 20);
  if (error) fail("The community feed could not be loaded.", error.code);
  const parsedPosts = z.array(postRowSchema).safeParse(data);
  if (!parsedPosts.success) fail("Community posts failed validation.");
  const posts = parsedPosts.data.slice(0, 20);
  if (!posts.length) return { posts: [], page: safePage, hasMore: false };

  const postIds = posts.map((post) => post.id);
  const [statsResult, commentsResult] = await Promise.all([
    supabase.rpc("community_post_statistics", { p_post_ids: postIds }),
    supabase
      .from("community_comments")
      .select("id,author_id,post_id,answer_id,parent_comment_id,body,created_at")
      .in("post_id", postIds)
      .eq("moderation_status", "visible")
      .order("created_at", { ascending: true })
      .limit(100),
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
  supabase: SupabaseClient,
  userId: string,
  filters: { subject?: string; topic?: string; status?: string; search?: string },
) {
  let query = supabase
    .from("community_questions")
    .select("id,author_id,group_id,title,body,subject,topic,question_status,accepted_answer_id,created_at")
    .eq("moderation_status", "visible")
    .order("created_at", { ascending: false })
    .limit(20);
  if (filters.subject) query = query.eq("subject", filters.subject);
  if (filters.topic) query = query.ilike("topic", `%${filters.topic.replace(/[%_]/g, "")}%`);
  if (filters.status === "open" || filters.status === "answered" || filters.status === "closed") {
    query = query.eq("question_status", filters.status);
  }
  if (filters.search) {
    const safeSearch = filters.search.replace(/[%_,]/g, " ").trim();
    if (safeSearch) query = query.ilike("title", `%${safeSearch}%`);
  }
  const { data, error } = await query;
  if (error) fail("Questions could not be loaded.", error.code);
  const parsedQuestions = z.array(questionRowSchema).safeParse(data);
  if (!parsedQuestions.success) fail("Community questions failed validation.");
  const questions = parsedQuestions.data;
  if (!questions.length) return [];

  const questionIds = questions.map((question) => question.id);
  const { data: answerData, error: answerError } = await supabase
    .from("community_answers")
    .select("id,question_id,author_id,body,created_at")
    .in("question_id", questionIds)
    .eq("moderation_status", "visible")
    .order("created_at", { ascending: true })
    .limit(100);
  if (answerError) fail("Question answers could not be loaded.", answerError.code);
  const parsedAnswers = z.array(answerRowSchema).safeParse(answerData);
  if (!parsedAnswers.success) fail("Question answers failed validation.");
  const answerIds = parsedAnswers.data.map((answer) => answer.id);
  const { data: commentData, error: commentError } = answerIds.length
    ? await supabase
        .from("community_comments")
        .select("id,author_id,post_id,answer_id,parent_comment_id,body,created_at")
        .in("answer_id", answerIds)
        .eq("moderation_status", "visible")
        .order("created_at", { ascending: true })
        .limit(100)
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

export async function loadStudyGroups(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("study_groups")
    .select("id,created_by,name,description,subject,visibility,created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) fail("Study groups could not be loaded.", error.code);
  const parsedGroups = z.array(groupRowSchema).safeParse(data);
  if (!parsedGroups.success) fail("Study group data failed validation.");
  if (!parsedGroups.data.length) return { groups: [], requests: [], members: [] };
  const groupIds = parsedGroups.data.map((group) => group.id);
  const statsResult = await supabase.rpc("community_group_statistics", {
    p_group_ids: groupIds,
  });
  if (statsResult.error) fail("Study group membership totals could not be loaded.", statsResult.error.code);
  const parsedStats = z.array(groupStatSchema).safeParse(statsResult.data);
  if (!parsedStats.success || parsedStats.data.length !== parsedGroups.data.length) {
    fail("Study group membership totals failed validation.");
  }
  const [requestResult, memberResult] = await Promise.all([
    supabase
      .from("study_group_members")
      .select("id,group_id,user_id,member_role,membership_status,created_at")
      .in("group_id", groupIds)
      .eq("membership_status", "pending")
      .limit(100),
    supabase
      .from("study_group_members")
      .select("id,group_id,user_id,member_role,membership_status,created_at")
      .in("group_id", groupIds)
      .eq("membership_status", "active")
      .limit(100),
  ]);
  if (requestResult.error || memberResult.error) {
    fail("Study group members could not be loaded.", requestResult.error?.code ?? memberResult.error?.code);
  }
  const parsedRequests = z.array(groupMemberSchema).safeParse(requestResult.data);
  const parsedMembers = z.array(groupMemberSchema).safeParse(memberResult.data);
  if (!parsedRequests.success || !parsedMembers.success) fail("Study group members failed validation.");
  const stats = new Map(parsedStats.data.map((item) => [item.group_id, item]));
  const userIds = [...parsedMembers.data, ...parsedRequests.data].map((member) => member.user_id);
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
    requests: parsedRequests.data.map(memberDto),
    members: parsedMembers.data.map(memberDto),
  };
}

export async function loadStudyGroupDetail(
  supabase: SupabaseClient,
  userId: string,
  groupId: string,
) {
  const { data, error } = await supabase
    .from("study_groups")
    .select("id,created_by,name,description,subject,visibility,created_at")
    .eq("id", groupId)
    .maybeSingle();
  if (error) fail("The study group could not be loaded.", error.code);
  if (!data) return null;
  const parsedGroup = groupRowSchema.safeParse(data);
  if (!parsedGroup.success) fail("Study group data failed validation.");
  const statsResult = await supabase.rpc("community_group_statistics", {
    p_group_ids: [groupId],
  });
  if (statsResult.error) fail("Study group membership totals could not be loaded.", statsResult.error.code);
  const parsedStats = z.array(groupStatSchema).safeParse(statsResult.data);
  if (!parsedStats.success || parsedStats.data.length !== 1) {
    fail("Study group membership totals failed validation.");
  }
  const [requestResult, memberResult] = await Promise.all([
    supabase
      .from("study_group_members")
      .select("id,group_id,user_id,member_role,membership_status,created_at")
      .eq("group_id", groupId)
      .eq("membership_status", "pending")
      .limit(100),
    supabase
      .from("study_group_members")
      .select("id,group_id,user_id,member_role,membership_status,created_at")
      .eq("group_id", groupId)
      .eq("membership_status", "active")
      .limit(100),
  ]);
  if (requestResult.error || memberResult.error) {
    fail("Study group members could not be loaded.", requestResult.error?.code ?? memberResult.error?.code);
  }
  const parsedRequests = z.array(groupMemberSchema).safeParse(requestResult.data);
  const parsedMembers = z.array(groupMemberSchema).safeParse(memberResult.data);
  if (!parsedRequests.success || !parsedMembers.success) fail("Study group members failed validation.");
  const profiles = await loadVisibleProfiles(supabase, [
    ...parsedRequests.data.map((member) => member.user_id),
    ...parsedMembers.data.map((member) => member.user_id),
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
    requests: parsedRequests.data.map(memberDto),
    members: parsedMembers.data.map(memberDto),
  };
}

export async function loadCommunityFeatures(
  supabase: SupabaseClient,
): Promise<CommunityFeatures> {
  const entries = await Promise.all(featureKeys.map(async (key) => {
    const { data, error } = await supabase.rpc("is_feature_enabled", {
      p_key: key,
    });
    if (error) fail("Community feature availability could not be checked.", error.code);
    return [key, data === true] as const;
  }));
  return Object.fromEntries(entries) as CommunityFeatures;
}

export async function loadCommunityNotifications(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("community_notifications")
    .select("id,actor_id,event_type,target_type,target_id,created_at,read_at")
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

export async function loadCommunityBlocks(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("community_blocks")
    .select("blocked_id,created_at")
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

export async function loadCommunityModeration(
  supabase: SupabaseClient,
  search?: string,
) {
  const [overviewResult, learnerResult, reportsResult] = await Promise.all([
    supabase.rpc("owner_community_overview"),
    supabase.rpc("owner_list_community_learners", {
      p_limit: 100,
      p_search: search?.trim() || null,
    }),
    supabase
      .from("community_reports")
      .select("id,reported_by,target_type,target_id,reason,created_at")
      .eq("report_status", "pending")
      .order("created_at", { ascending: true })
      .limit(50),
  ]);
  if (overviewResult.error || learnerResult.error || reportsResult.error) {
    fail(
      "Community moderation data could not be loaded.",
      overviewResult.error?.code ?? learnerResult.error?.code ?? reportsResult.error?.code,
    );
  }
  const overview = z.array(ownerOverviewSchema).safeParse(overviewResult.data);
  const learners = z.array(ownerLearnerSchema).safeParse(learnerResult.data);
  const reports = z.array(reportRowSchema).safeParse(reportsResult.data);
  if (!overview.success || overview.data.length !== 1 || !learners.success || !reports.success) {
    fail("Community moderation data failed validation.");
  }

  const byType = (targetType: z.infer<typeof reportRowSchema>["target_type"]) =>
    reports.data.filter((report) => report.target_type === targetType).map((report) => report.target_id);
  const [postsResult, commentsResult, questionsResult, answersResult] = await Promise.all([
    byType("post").length
      ? supabase.from("community_posts").select("id,author_id,body").in("id", byType("post"))
      : Promise.resolve({ data: [], error: null }),
    byType("comment").length
      ? supabase.from("community_comments").select("id,author_id,body").in("id", byType("comment"))
      : Promise.resolve({ data: [], error: null }),
    byType("question").length
      ? supabase.from("community_questions").select("id,author_id,title,body").in("id", byType("question"))
      : Promise.resolve({ data: [], error: null }),
    byType("answer").length
      ? supabase.from("community_answers").select("id,author_id,body").in("id", byType("answer"))
      : Promise.resolve({ data: [], error: null }),
  ]);
  const contentResults = [postsResult, commentsResult, questionsResult, answersResult];
  const failedContent = contentResults.find((result) => result.error);
  if (failedContent?.error) fail("Reported content could not be loaded.", failedContent.error.code);

  const contentMap = new Map<string, z.infer<typeof moderationTextSchema>>();
  for (const result of contentResults) {
    const parsedContent = z.array(moderationTextSchema).safeParse(result.data);
    if (!parsedContent.success) fail("Reported content failed validation.");
    for (const content of parsedContent.data) contentMap.set(content.id, content);
  }
  return {
    overview: overview.data[0],
    learners: learners.data.map((learner) => ({
      ...learner,
      suspended: learner.community_suspended_until !== null &&
        Date.parse(learner.community_suspended_until) > Date.now(),
    })),
    reports: reports.data.map((report) => ({
      ...report,
      content: contentMap.get(report.target_id) ?? null,
    })),
  };
}

export async function loadOwnCommunityProfile(supabase: SupabaseClient, userId: string) {
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
  supabase: SupabaseClient,
  userId: string,
) {
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
  if (!parsed.data.show_achievements) return { ...parsed.data, badges: [] };
  const { data: badgeData, error: badgeError } = await supabase.rpc(
    "community_visible_badges",
    { p_user_id: userId },
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
