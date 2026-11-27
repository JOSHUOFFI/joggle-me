"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  isSafeAvatarUrl,
  parseTagList,
  textSchema,
  uuidSchema,
} from "@/lib/community/validation";

const feedPath = "/dashboard/community";
const questionsPath = "/dashboard/community/questions";
const groupsPath = "/dashboard/community/groups";
const activityPath = "/dashboard/community/activity";
const profilePath = "/dashboard/community/profile";
const ownerCommunityPath = "/owner/community";

function safePath(value: FormDataEntryValue | null, fallback: string) {
  if (typeof value !== "string") return fallback;
  if (
    [feedPath, questionsPath, groupsPath, activityPath, profilePath]
      .includes(value)
  ) return value;
  if (/^\/dashboard\/community\/groups\/[0-9a-f-]{36}$/i.test(value)) return value;
  return fallback;
}

function go(path: string, key: "notice" | "error", value: string): never {
  revalidatePath("/dashboard/community");
  revalidatePath("/dashboard/community/questions");
  revalidatePath("/dashboard/community/groups");
  revalidatePath("/dashboard/community/activity");
  revalidatePath("/owner/community");
  redirect(`${path}?${key}=${encodeURIComponent(value)}`);
}

async function requireFeature(
  supabase: Awaited<ReturnType<typeof requireRole>>["supabase"],
  flag: string,
  path: string,
) {
  const { data, error } = await supabase.rpc("is_feature_enabled", { p_key: flag });
  if (error) {
    logger.error("Community feature availability could not be checked", {
      feature: flag,
      code: error.code ?? null,
    });
    go(path, "error", "unavailable");
  }
  if (data !== true) go(path, "error", "disabled");
}

function parsedUuid(value: FormDataEntryValue | null) {
  return typeof value === "string" ? uuidSchema.safeParse(value) : null;
}

function actionFailure(action: string, error: { code?: string | null }, path: string): never {
  logger.error("Community action failed", {
    action,
    code: error.code ?? null,
  });
  go(path, "error", "save");
}

export async function createCommunityPostAction(formData: FormData) {
  const { supabase, user } = await requireRole(["learner"]);
  const path = safePath(formData.get("returnTo"), feedPath);
  await requireFeature(supabase, "community_enabled", path);
  await requireFeature(supabase, "community_posts_enabled", path);
  const body = textSchema(1, 3000).safeParse(formData.get("body"));
  const postType = formData.get("postType");
  const groupValue = formData.get("groupId");
  const groupId = groupValue ? parsedUuid(groupValue) : null;
  if (
    !body.success ||
    !["discussion", "study_tip", "achievement"].includes(String(postType)) ||
    (groupValue && !groupId?.success)
  ) go(path, "error", "validation");
  const { error } = await supabase.from("community_posts").insert({
    author_id: user.id,
    group_id: groupId?.success ? groupId.data : null,
    post_type: postType as "discussion" | "study_tip" | "achievement",
    body: body.data,
  });
  if (error) actionFailure("create_post", error, path);
  go(path, "notice", "post_created");
}

export async function editCommunityPostAction(formData: FormData) {
  const { supabase, user } = await requireRole(["learner"]);
  const path = safePath(formData.get("returnTo"), feedPath);
  await requireFeature(supabase, "community_posts_enabled", path);
  const id = parsedUuid(formData.get("postId"));
  const body = textSchema(1, 3000).safeParse(formData.get("body"));
  if (!id?.success || !body.success) go(path, "error", "validation");
  const { error } = await supabase
    .from("community_posts")
    .update({ body: body.data })
    .eq("id", id.data)
    .eq("author_id", user.id);
  if (error) actionFailure("edit_post", error, path);
  go(path, "notice", "post_updated");
}

export async function deleteCommunityPostAction(formData: FormData) {
  const { supabase, user } = await requireRole(["learner"]);
  const path = safePath(formData.get("returnTo"), feedPath);
  const id = parsedUuid(formData.get("postId"));
  if (!id?.success) go(path, "error", "validation");
  const { error } = await supabase
    .from("community_posts")
    .delete()
    .eq("id", id.data)
    .eq("author_id", user.id);
  if (error) actionFailure("delete_post", error, path);
  go(path, "notice", "post_deleted");
}

export async function createCommunityCommentAction(formData: FormData) {
  const { supabase, user } = await requireRole(["learner"]);
  const path = safePath(formData.get("returnTo"), feedPath);
  await requireFeature(supabase, "community_posts_enabled", path);
  const body = textSchema(1, 1500).safeParse(formData.get("body"));
  const postValue = formData.get("postId");
  const answerValue = formData.get("answerId");
  const parentValue = formData.get("parentCommentId");
  const postId = postValue ? parsedUuid(postValue) : null;
  const answerId = answerValue ? parsedUuid(answerValue) : null;
  const parentId = parentValue ? parsedUuid(parentValue) : null;
  if (
    !body.success ||
    Boolean(postValue) === Boolean(answerValue) ||
    (postValue && !postId?.success) ||
    (answerValue && !answerId?.success) ||
    (parentValue && !parentId?.success)
  ) go(path, "error", "validation");
  const { error } = await supabase.from("community_comments").insert({
    author_id: user.id,
    post_id: postId?.success ? postId.data : null,
    answer_id: answerId?.success ? answerId.data : null,
    parent_comment_id: parentId?.success ? parentId.data : null,
    body: body.data,
  });
  if (error) actionFailure("create_comment", error, path);
  go(path, "notice", "comment_created");
}

export async function editCommunityCommentAction(formData: FormData) {
  const { supabase, user } = await requireRole(["learner"]);
  const path = safePath(formData.get("returnTo"), feedPath);
  const id = parsedUuid(formData.get("commentId"));
  const body = textSchema(1, 1500).safeParse(formData.get("body"));
  if (!id?.success || !body.success) go(path, "error", "validation");
  const { error } = await supabase
    .from("community_comments")
    .update({ body: body.data })
    .eq("id", id.data)
    .eq("author_id", user.id);
  if (error) actionFailure("edit_comment", error, path);
  go(path, "notice", "comment_updated");
}

export async function deleteCommunityCommentAction(formData: FormData) {
  const { supabase, user } = await requireRole(["learner"]);
  const path = safePath(formData.get("returnTo"), feedPath);
  const id = parsedUuid(formData.get("commentId"));
  if (!id?.success) go(path, "error", "validation");
  const { error } = await supabase
    .from("community_comments")
    .delete()
    .eq("id", id.data)
    .eq("author_id", user.id);
  if (error) actionFailure("delete_comment", error, path);
  go(path, "notice", "comment_deleted");
}

export async function toggleCommunityReactionAction(formData: FormData) {
  const { supabase, user } = await requireRole(["learner"]);
  const path = safePath(formData.get("returnTo"), feedPath);
  await requireFeature(supabase, "community_posts_enabled", path);
  const postId = parsedUuid(formData.get("postId"));
  const reactionType = formData.get("reactionType");
  if (!postId?.success || !["like", "helpful", "celebrate"].includes(String(reactionType))) {
    go(path, "error", "validation");
  }
  const existing = await supabase
    .from("community_reactions")
    .select("id")
    .eq("post_id", postId.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing.error) actionFailure("read_reaction", existing.error, path);
  const result = existing.data
    ? await supabase.from("community_reactions").delete().eq("id", existing.data.id)
    : await supabase.from("community_reactions").insert({
        post_id: postId.data,
        user_id: user.id,
        reaction_type: String(reactionType),
      });
  if (result.error) actionFailure("toggle_reaction", result.error, path);
  go(path, "notice", "reaction_saved");
}

export async function createCommunityQuestionAction(formData: FormData) {
  const { supabase, user } = await requireRole(["learner"]);
  const path = safePath(formData.get("returnTo"), questionsPath);
  await requireFeature(supabase, "community_enabled", path);
  await requireFeature(supabase, "community_questions_enabled", path);
  const title = textSchema(5, 180).safeParse(formData.get("title"));
  const body = textSchema(1, 3000).safeParse(formData.get("body"));
  const subject = textSchema(1, 80).safeParse(formData.get("subject"));
  const topic = textSchema(0, 100).safeParse(String(formData.get("topic") ?? ""));
  const groupValue = formData.get("groupId");
  const groupId = groupValue ? parsedUuid(groupValue) : null;
  if (
    !title.success || !body.success || !subject.success || !topic.success ||
    (groupValue && !groupId?.success)
  ) go(path, "error", "validation");
  const { error } = await supabase.from("community_questions").insert({
    author_id: user.id,
    group_id: groupId?.success ? groupId.data : null,
    title: title.data,
    body: body.data,
    subject: subject.data,
    topic: topic.data,
  });
  if (error) actionFailure("create_question", error, path);
  go(path, "notice", "question_created");
}

export async function editCommunityQuestionAction(formData: FormData) {
  const { supabase, user } = await requireRole(["learner"]);
  const path = safePath(formData.get("returnTo"), questionsPath);
  const id = parsedUuid(formData.get("questionId"));
  const title = textSchema(5, 180).safeParse(formData.get("title"));
  const body = textSchema(1, 3000).safeParse(formData.get("body"));
  const subject = textSchema(1, 80).safeParse(formData.get("subject"));
  const topic = textSchema(0, 100).safeParse(String(formData.get("topic") ?? ""));
  if (!id?.success || !title.success || !body.success || !subject.success || !topic.success) {
    go(path, "error", "validation");
  }
  const { error } = await supabase
    .from("community_questions")
    .update({
      title: title.data,
      body: body.data,
      subject: subject.data,
      topic: topic.data,
    })
    .eq("id", id.data)
    .eq("author_id", user.id);
  if (error) actionFailure("edit_question", error, path);
  go(path, "notice", "question_updated");
}

export async function deleteCommunityQuestionAction(formData: FormData) {
  const { supabase, user } = await requireRole(["learner"]);
  const path = safePath(formData.get("returnTo"), questionsPath);
  const id = parsedUuid(formData.get("questionId"));
  if (!id?.success) go(path, "error", "validation");
  const { error } = await supabase
    .from("community_questions")
    .delete()
    .eq("id", id.data)
    .eq("author_id", user.id);
  if (error) actionFailure("delete_question", error, path);
  go(path, "notice", "question_deleted");
}

export async function createCommunityAnswerAction(formData: FormData) {
  const { supabase, user } = await requireRole(["learner"]);
  const path = safePath(formData.get("returnTo"), questionsPath);
  await requireFeature(supabase, "community_questions_enabled", path);
  const questionId = parsedUuid(formData.get("questionId"));
  const body = textSchema(1, 3000).safeParse(formData.get("body"));
  if (!questionId?.success || !body.success) go(path, "error", "validation");
  const { error } = await supabase.from("community_answers").insert({
    question_id: questionId.data,
    author_id: user.id,
    body: body.data,
  });
  if (error) actionFailure("create_answer", error, path);
  go(path, "notice", "answer_created");
}

export async function editCommunityAnswerAction(formData: FormData) {
  const { supabase, user } = await requireRole(["learner"]);
  const path = safePath(formData.get("returnTo"), questionsPath);
  const id = parsedUuid(formData.get("answerId"));
  const body = textSchema(1, 3000).safeParse(formData.get("body"));
  if (!id?.success || !body.success) go(path, "error", "validation");
  const { error } = await supabase
    .from("community_answers")
    .update({ body: body.data })
    .eq("id", id.data)
    .eq("author_id", user.id);
  if (error) actionFailure("edit_answer", error, path);
  go(path, "notice", "answer_updated");
}

export async function deleteCommunityAnswerAction(formData: FormData) {
  const { supabase, user } = await requireRole(["learner"]);
  const path = safePath(formData.get("returnTo"), questionsPath);
  const id = parsedUuid(formData.get("answerId"));
  if (!id?.success) go(path, "error", "validation");
  const { error } = await supabase
    .from("community_answers")
    .delete()
    .eq("id", id.data)
    .eq("author_id", user.id);
  if (error) actionFailure("delete_answer", error, path);
  go(path, "notice", "answer_deleted");
}

export async function acceptCommunityAnswerAction(formData: FormData) {
  const { supabase } = await requireRole(["learner"]);
  const path = safePath(formData.get("returnTo"), questionsPath);
  const questionId = parsedUuid(formData.get("questionId"));
  const answerId = parsedUuid(formData.get("answerId"));
  if (!questionId?.success || !answerId?.success) go(path, "error", "validation");
  const { error } = await supabase.rpc("community_accept_answer", {
    p_question_id: questionId.data,
    p_answer_id: answerId.data,
  });
  if (error) actionFailure("accept_answer", error, path);
  go(path, "notice", "answer_accepted");
}

export async function createStudyGroupAction(formData: FormData) {
  const { supabase, user } = await requireRole(["learner"]);
  const path = safePath(formData.get("returnTo"), groupsPath);
  await requireFeature(supabase, "study_groups_enabled", path);
  const name = textSchema(3, 80).safeParse(formData.get("name"));
  const description = textSchema(1, 1200).safeParse(formData.get("description"));
  const subject = textSchema(1, 80).safeParse(formData.get("subject"));
  const visibility = formData.get("visibility");
  if (
    !name.success || !description.success || !subject.success ||
    !["public", "private"].includes(String(visibility))
  ) go(path, "error", "validation");
  const { data, error } = await supabase.from("study_groups").insert({
    created_by: user.id,
    name: name.data,
    description: description.data,
    subject: subject.data,
    visibility: String(visibility),
  }).select("id").single();
  if (error || !data) actionFailure("create_study_group", error ?? { code: "missing_group" }, path);
  go(`${groupsPath}/${data.id}`, "notice", "group_created");
}

export async function updateStudyGroupAction(formData: FormData) {
  const { supabase } = await requireRole(["learner"]);
  const path = safePath(formData.get("returnTo"), groupsPath);
  await requireFeature(supabase, "study_groups_enabled", path);
  const id = parsedUuid(formData.get("groupId"));
  const name = textSchema(3, 80).safeParse(formData.get("name"));
  const description = textSchema(1, 1200).safeParse(formData.get("description"));
  const subject = textSchema(1, 80).safeParse(formData.get("subject"));
  const visibility = formData.get("visibility");
  if (
    !id?.success || !name.success || !description.success || !subject.success ||
    !["public", "private"].includes(String(visibility))
  ) go(path, "error", "validation");
  const { error } = await supabase
    .from("study_groups")
    .update({
      name: name.data,
      description: description.data,
      subject: subject.data,
      visibility: String(visibility),
    })
    .eq("id", id.data);
  if (error) actionFailure("update_study_group", error, path);
  go(path, "notice", "group_updated");
}

export async function deleteStudyGroupAction(formData: FormData) {
  const { supabase, user } = await requireRole(["learner"]);
  const path = safePath(formData.get("returnTo"), groupsPath);
  const id = parsedUuid(formData.get("groupId"));
  if (!id?.success) go(path, "error", "validation");
  const { error } = await supabase
    .from("study_groups")
    .delete()
    .eq("id", id.data)
    .eq("created_by", user.id);
  if (error) actionFailure("delete_study_group", error, path);
  go(groupsPath, "notice", "group_deleted");
}

export async function joinStudyGroupAction(formData: FormData) {
  const { supabase } = await requireRole(["learner"]);
  const path = safePath(formData.get("returnTo"), groupsPath);
  await requireFeature(supabase, "study_groups_enabled", path);
  const groupId = parsedUuid(formData.get("groupId"));
  if (!groupId?.success) go(path, "error", "validation");
  const { data, error } = await supabase.rpc("community_join_group", {
    p_group_id: groupId.data,
  });
  if (error) actionFailure("join_study_group", error, path);
  if (data === "active") go(path, "notice", "group_joined");
  if (data === "pending") go(path, "notice", "request_sent");
  actionFailure("join_study_group", { code: "invalid_membership_status" }, path);
}

export async function leaveStudyGroupAction(formData: FormData) {
  const { supabase, user } = await requireRole(["learner"]);
  const path = safePath(formData.get("returnTo"), groupsPath);
  await requireFeature(supabase, "study_groups_enabled", path);
  const groupId = parsedUuid(formData.get("groupId"));
  if (!groupId?.success) go(path, "error", "validation");
  const { error } = await supabase
    .from("study_group_members")
    .delete()
    .eq("group_id", groupId.data)
    .eq("user_id", user.id);
  if (error) actionFailure("leave_study_group", error, path);
  go(path, "notice", "group_left");
}

export async function reviewGroupRequestAction(formData: FormData) {
  const { supabase } = await requireRole(["learner"]);
  const path = safePath(formData.get("returnTo"), groupsPath);
  await requireFeature(supabase, "study_groups_enabled", path);
  const membershipId = parsedUuid(formData.get("membershipId"));
  const approve = formData.get("approve") === "true";
  if (!membershipId?.success) go(path, "error", "validation");
  const { error } = await supabase.rpc("community_review_group_request", {
    p_membership_id: membershipId.data,
    p_approve: approve,
  });
  if (error) actionFailure("review_group_request", error, path);
  go(path, "notice", approve ? "request_approved" : "request_rejected");
}

export async function updateCommunityProfileAction(formData: FormData) {
  const { supabase, user } = await requireRole(["learner"]);
  await requireFeature(supabase, "community_enabled", profilePath);
  const displayName = textSchema(1, 60).safeParse(formData.get("displayName"));
  const biography = textSchema(0, 300).safeParse(String(formData.get("biography") ?? ""));
  const avatarUrl = String(formData.get("avatarUrl") ?? "").trim();
  const interests = parseTagList(formData.get("interests"));
  const subjects = parseTagList(formData.get("subjects"));
  if (
    !displayName.success ||
    !biography.success ||
    !isSafeAvatarUrl(avatarUrl) ||
    interests === null ||
    subjects === null
  ) {
    go(profilePath, "error", "validation");
  }
  const { error } = await supabase.from("community_profiles").upsert({
    user_id: user.id,
    display_name: displayName.data,
    avatar_url: avatarUrl || null,
    biography: biography.data,
    learning_interests: interests,
    subjects,
    profile_visible: formData.get("profileVisible") === "true",
    show_achievements: formData.get("showAchievements") === "true",
  }, { onConflict: "user_id" });
  if (error) actionFailure("update_community_profile", error, profilePath);
  go(profilePath, "notice", "profile_updated");
}

export async function reportCommunityContentAction(formData: FormData) {
  const { supabase, user } = await requireRole(["learner"]);
  const path = safePath(formData.get("returnTo"), feedPath);
  await requireFeature(supabase, "community_enabled", path);
  const targetId = parsedUuid(formData.get("targetId"));
  const targetType = formData.get("targetType");
  const reason = textSchema(3, 500).safeParse(formData.get("reason"));
  if (
    !targetId?.success || !reason.success ||
    !["post", "comment", "question", "answer"].includes(String(targetType))
  ) go(path, "error", "validation");
  const { error } = await supabase.from("community_reports").insert({
    reported_by: user.id,
    target_type: String(targetType),
    target_id: targetId.data,
    reason: reason.data,
  });
  if (error) actionFailure("report_community_content", error, path);
  go(path, "notice", "report_sent");
}

export async function blockCommunityMemberAction(formData: FormData) {
  const { supabase, user } = await requireRole(["learner"]);
  const path = safePath(formData.get("returnTo"), feedPath);
  await requireFeature(supabase, "community_enabled", path);
  const blockedId = parsedUuid(formData.get("blockedId"));
  if (!blockedId?.success || blockedId.data === user.id) go(path, "error", "validation");
  const { error } = await supabase.from("community_blocks").insert({
    blocker_id: user.id,
    blocked_id: blockedId.data,
  });
  if (error?.code === "23505") go(path, "notice", "already_blocked");
  if (error) actionFailure("block_community_member", error, path);
  go(path, "notice", "member_blocked");
}

export async function unblockCommunityMemberAction(formData: FormData) {
  const { supabase, user } = await requireRole(["learner"]);
  const blockedId = parsedUuid(formData.get("blockedId"));
  if (!blockedId?.success) go(activityPath, "error", "validation");
  const { error } = await supabase
    .from("community_blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", blockedId.data);
  if (error) actionFailure("unblock_community_member", error, activityPath);
  go(activityPath, "notice", "member_unblocked");
}

export async function markCommunityNotificationReadAction(formData: FormData) {
  const { supabase, user } = await requireRole(["learner"]);
  await requireFeature(supabase, "community_notifications_enabled", activityPath);
  const id = parsedUuid(formData.get("notificationId"));
  if (!id?.success) go(activityPath, "error", "validation");
  const { error } = await supabase
    .from("community_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("recipient_id", user.id);
  if (error) actionFailure("mark_notification_read", error, activityPath);
  go(activityPath, "notice", "notification_read");
}

export async function moderateCommunityReportAction(formData: FormData) {
  const { supabase } = await requireRole(["platform_owner", "platform_administrator"]);
  const reportId = parsedUuid(formData.get("reportId"));
  const decision = formData.get("decision");
  const resolution = textSchema(3, 500).safeParse(formData.get("resolution"));
  const removeContent = formData.get("removeContent") === "true";
  if (
    !reportId?.success || !resolution.success ||
    !["upheld", "dismissed"].includes(String(decision)) ||
    (decision === "dismissed" && removeContent)
  ) go(ownerCommunityPath, "error", "validation");
  const { error } = await supabase.rpc("owner_moderate_community_report", {
    p_report_id: reportId.data,
    p_decision: String(decision),
    p_remove_content: removeContent,
    p_resolution: resolution.data,
  });
  if (error) actionFailure("moderate_community_report", error, ownerCommunityPath);
  go(ownerCommunityPath, "notice", "report_resolved");
}

export async function setCommunitySuspensionAction(formData: FormData) {
  const { supabase } = await requireRole(["platform_owner", "platform_administrator"]);
  const userId = parsedUuid(formData.get("userId"));
  const suspend = formData.get("suspend") === "true";
  const daysValue = Number(formData.get("durationDays") ?? 7);
  if (!userId?.success || !Number.isInteger(daysValue) || daysValue < 1 || daysValue > 365) {
    go(ownerCommunityPath, "error", "validation");
  }
  const { error } = await supabase.rpc("owner_set_community_suspension", {
    p_target_user_id: userId.data,
    p_suspend: suspend,
    p_duration_days: daysValue,
  });
  if (error) actionFailure("set_community_suspension", error, ownerCommunityPath);
  go(ownerCommunityPath, "notice", suspend ? "participation_suspended" : "participation_restored");
}
