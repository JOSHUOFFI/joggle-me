import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import {
  CommunityAvatar,
  CommunityDisabled,
  CommunityFeedback,
  CommunityNavigation,
  CommunityPageHeader,
  BlockLearnerForm,
} from "@/components/community-ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import {
  CommunityDataError,
  loadCommunityFeatures,
  loadCommunityQuestions,
} from "@/lib/community/data";
import {
  acceptCommunityAnswerAction,
  createCommunityAnswerAction,
  createCommunityCommentAction,
  createCommunityQuestionAction,
  deleteCommunityAnswerAction,
  deleteCommunityCommentAction,
  deleteCommunityQuestionAction,
  editCommunityAnswerAction,
  editCommunityCommentAction,
  editCommunityQuestionAction,
  reportCommunityContentAction,
} from "@/lib/actions/community";

type QuestionSearchParams = Promise<{
  notice?: string;
  error?: string;
  subject?: string;
  topic?: string;
  status?: string;
  search?: string;
}>;

export default async function CommunityQuestionsPage({
  searchParams,
}: {
  searchParams: QuestionSearchParams;
}) {
  const { supabase, user } = await requireRole(["learner"]);
  const [features, params] = await Promise.all([
    loadCommunityFeatures(supabase),
    searchParams,
  ]);
  return (
    <AppShell>
      <CommunityNavigation />
      <CommunityPageHeader
        eyebrow="Learn together"
        title="Questions & answers"
        description="Ask academic questions, share what you know, and help other learners understand difficult concepts."
      />
      <CommunityFeedback notice={params.notice} error={params.error} />
      {!features.community_enabled || !features.community_questions_enabled ? (
        <CommunityDisabled feature="Questions and answers" />
      ) : (
        <QuestionsContent
          supabase={supabase}
          userId={user.id}
          params={params}
          commentsEnabled={features.community_posts_enabled}
        />
      )}
    </AppShell>
  );
}

async function QuestionsContent({
  supabase,
  userId,
  params,
  commentsEnabled,
}: {
  supabase: Awaited<ReturnType<typeof requireRole>>["supabase"];
  userId: string;
  params: Awaited<QuestionSearchParams>;
  commentsEnabled: boolean;
}) {
  let questions: Awaited<ReturnType<typeof loadCommunityQuestions>>;
  try {
    questions = await loadCommunityQuestions(supabase, userId, {
      subject: params.subject?.slice(0, 80),
      topic: params.topic?.slice(0, 100),
      status: params.status,
      search: params.search?.slice(0, 120),
    });
  } catch (error) {
    if (!(error instanceof CommunityDataError)) throw error;
    return <Card className="p-5 text-sm text-red-700" role="alert">{error.message}</Card>;
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(270px,.7fr)]">
      <div className="space-y-4">
        <Card className="p-4 sm:p-5">
          <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold text-[#77758A]">
              Search
              <input name="search" defaultValue={params.search} maxLength={120} placeholder="Question title" className="mt-1 h-10 w-full rounded-lg border border-[#DDD8EF] px-3 text-sm text-[#343247]" />
            </label>
            <label className="text-xs font-semibold text-[#77758A]">
              Subject
              <input name="subject" defaultValue={params.subject} maxLength={80} placeholder="e.g. Biology" className="mt-1 h-10 w-full rounded-lg border border-[#DDD8EF] px-3 text-sm text-[#343247]" />
            </label>
            <label className="text-xs font-semibold text-[#77758A]">
              Topic
              <input name="topic" defaultValue={params.topic} maxLength={100} placeholder="e.g. Cells" className="mt-1 h-10 w-full rounded-lg border border-[#DDD8EF] px-3 text-sm text-[#343247]" />
            </label>
            <label className="text-xs font-semibold text-[#77758A]">
              Status
              <select name="status" defaultValue={params.status ?? ""} className="mt-1 h-10 w-full rounded-lg border border-[#DDD8EF] bg-white px-3 text-sm text-[#343247]">
                <option value="">All questions</option>
                <option value="open">Unanswered</option>
                <option value="answered">Answered</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <Button type="submit" variant="secondary" className="sm:col-span-2 lg:col-span-4">Filter questions</Button>
          </form>
        </Card>

        {questions.length ? questions.map((question) => (
          <Card key={question.id} id={`question-${question.id}`} className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <CommunityAvatar displayName={question.author.displayName} avatarUrl={question.author.avatarUrl} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#7655D9]">
                      {question.subject}{question.topic ? ` · ${question.topic}` : ""}
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-[#35216B]">{question.title}</h2>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${question.question_status === "open" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                    {question.question_status === "open" ? "Unanswered" : question.question_status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#77758A]">
                  Asked by {question.author.profileHref
                    ? <Link href={question.author.profileHref} className="font-semibold text-[#7655D9] hover:underline">{question.author.displayName}</Link>
                    : question.author.displayName} · {new Date(question.created_at).toLocaleDateString()}
                  {question.group_id && <> · <Link href={`/dashboard/community/groups/${question.group_id}`} className="font-semibold text-[#7655D9] hover:underline">Study group</Link></>}
                </p>
                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-[#343247]">{question.body}</p>

                {question.author_id === userId ? (
                  <div className="mt-3 flex flex-wrap gap-3">
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold text-[#7655D9]">Edit question</summary>
                      <form action={editCommunityQuestionAction} className="mt-2 grid gap-2">
                        <input type="hidden" name="questionId" value={question.id} />
                        <input type="hidden" name="returnTo" value="/dashboard/community/questions" />
                        <input name="title" defaultValue={question.title} maxLength={180} required className="h-10 rounded-lg border border-[#DDD8EF] px-3 text-sm" />
                        <textarea name="body" defaultValue={question.body} maxLength={3000} required className="min-h-20 rounded-lg border border-[#DDD8EF] p-2 text-sm" />
                        <input name="subject" defaultValue={question.subject} maxLength={80} required className="h-10 rounded-lg border border-[#DDD8EF] px-3 text-sm" />
                        <input name="topic" defaultValue={question.topic} maxLength={100} className="h-10 rounded-lg border border-[#DDD8EF] px-3 text-sm" />
                        <Button type="submit" size="sm">Save question</Button>
                      </form>
                    </details>
                    <form action={deleteCommunityQuestionAction}>
                      <input type="hidden" name="questionId" value={question.id} />
                      <input type="hidden" name="returnTo" value="/dashboard/community/questions" />
                      <ConfirmActionButton confirmation="Delete this question and its answers?" className="text-xs font-semibold text-red-700">Delete question</ConfirmActionButton>
                    </form>
                  </div>
                ) : (
                  <div className="mt-3">
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold text-[#77758A]">Safety</summary>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <BlockLearnerForm userId={question.author_id} returnTo="/dashboard/community/questions" />
                        <ReportForm targetType="question" targetId={question.id} />
                      </div>
                    </details>
                  </div>
                )}

                <div className="mt-5 space-y-3">
                  {question.answers.map((answer) => (
                    <div key={answer.id} id={`answer-${answer.id}`} className={`rounded-xl p-4 ${question.accepted_answer_id === answer.id ? "border border-emerald-200 bg-emerald-50/60" : "bg-[#F7F7FC]"}`}>
                      <div className="flex items-center gap-2">
                        <CommunityAvatar displayName={answer.author.displayName} avatarUrl={answer.author.avatarUrl} />
                        <div>
                          <p className="text-sm font-bold text-[#35216B]">
                            {answer.author.profileHref
                              ? <Link href={answer.author.profileHref} className="hover:underline">{answer.author.displayName}</Link>
                              : answer.author.displayName}
                          </p>
                          {question.accepted_answer_id === answer.id && <p className="text-xs font-semibold text-emerald-800">Accepted answer</p>}
                        </div>
                        <time className="ml-auto text-[11px] text-[#77758A]">{new Date(answer.created_at).toLocaleDateString()}</time>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#343247]">{answer.body}</p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {question.author_id === userId && !question.accepted_answer_id && (
                          <form action={acceptCommunityAnswerAction}>
                            <input type="hidden" name="questionId" value={question.id} />
                            <input type="hidden" name="answerId" value={answer.id} />
                            <input type="hidden" name="returnTo" value="/dashboard/community/questions" />
                            <Button type="submit" variant="secondary" size="sm">Accept answer</Button>
                          </form>
                        )}
                        {answer.author_id === userId ? (
                          <>
                            <details>
                              <summary className="cursor-pointer text-xs font-semibold text-[#7655D9]">Edit answer</summary>
                              <form action={editCommunityAnswerAction} className="mt-2 space-y-2">
                                <input type="hidden" name="answerId" value={answer.id} />
                                <input type="hidden" name="returnTo" value="/dashboard/community/questions" />
                                <textarea name="body" defaultValue={answer.body} maxLength={3000} required className="min-h-20 w-full rounded-lg border border-[#DDD8EF] p-2 text-sm" />
                                <Button type="submit" size="sm">Save answer</Button>
                              </form>
                            </details>
                            <form action={deleteCommunityAnswerAction}>
                              <input type="hidden" name="answerId" value={answer.id} />
                              <input type="hidden" name="returnTo" value="/dashboard/community/questions" />
                              <ConfirmActionButton confirmation="Delete this answer and its comments?" className="text-xs font-semibold text-red-700">Delete answer</ConfirmActionButton>
                            </form>
                          </>
                        ) : (
                          <>
                            <BlockLearnerForm userId={answer.author_id} returnTo="/dashboard/community/questions" />
                            <ReportForm targetType="answer" targetId={answer.id} />
                          </>
                        )}
                      </div>
                      {commentsEnabled && answer.comments.map((comment) => (
                        <div key={comment.id} className="mt-3 border-l-2 border-[#DDD8EF] pl-3">
                          <p className="text-xs font-semibold text-[#35216B]">
                            {comment.author.profileHref
                              ? <Link href={comment.author.profileHref} className="hover:underline">{comment.author.displayName}</Link>
                              : comment.author.displayName}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#343247]">{comment.body}</p>
                          {comment.parent_comment_id === null && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs font-semibold text-[#7655D9]">Reply</summary>
                              <form action={createCommunityCommentAction} className="mt-2 space-y-2">
                                <input type="hidden" name="answerId" value={answer.id} />
                                <input type="hidden" name="parentCommentId" value={comment.id} />
                                <input type="hidden" name="returnTo" value="/dashboard/community/questions" />
                                <textarea name="body" maxLength={1500} required placeholder="Write a reply" className="min-h-16 w-full rounded-lg border border-[#DDD8EF] p-2 text-sm" />
                                <Button type="submit" size="sm">Reply</Button>
                              </form>
                            </details>
                          )}
                          {comment.author_id === userId ? (
                            <>
                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs font-semibold text-[#7655D9]">Edit comment</summary>
                                <form action={editCommunityCommentAction} className="mt-2 space-y-2">
                                  <input type="hidden" name="commentId" value={comment.id} />
                                  <input type="hidden" name="returnTo" value="/dashboard/community/questions" />
                                  <textarea name="body" defaultValue={comment.body} maxLength={1500} required className="min-h-16 w-full rounded-lg border border-[#DDD8EF] p-2 text-sm" />
                                  <Button type="submit" size="sm">Save</Button>
                                </form>
                              </details>
                              <form action={deleteCommunityCommentAction} className="mt-2">
                                <input type="hidden" name="commentId" value={comment.id} />
                                <input type="hidden" name="returnTo" value="/dashboard/community/questions" />
                                <ConfirmActionButton confirmation="Delete this comment and any replies?" className="text-xs font-semibold text-red-700">Delete comment</ConfirmActionButton>
                              </form>
                            </>
                          ) : <ReportForm targetType="comment" targetId={comment.id} />}
                        </div>
                      ))}
                      {commentsEnabled ? (
                        <form action={createCommunityCommentAction} className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <input type="hidden" name="answerId" value={answer.id} />
                          <input type="hidden" name="returnTo" value="/dashboard/community/questions" />
                          <input name="body" maxLength={1500} required placeholder="Comment on this answer" className="h-10 min-w-0 flex-1 rounded-lg border border-[#DDD8EF] px-3 text-sm" />
                          <Button type="submit" variant="secondary" size="sm">Comment</Button>
                        </form>
                      ) : (
                        <p className="mt-3 text-xs text-[#77758A]">Answer comments are currently turned off.</p>
                      )}
                    </div>
                  ))}
                </div>
                {!question.answers.length && <p className="mt-4 text-sm font-semibold text-amber-800">No answers yet — share what you know.</p>}
                {question.question_status === "open" && question.author_id !== userId && (
                  <form action={createCommunityAnswerAction} className="mt-4 space-y-2">
                    <input type="hidden" name="questionId" value={question.id} />
                    <input type="hidden" name="returnTo" value="/dashboard/community/questions" />
                    <label htmlFor={`answer-${question.id}`} className="text-sm font-semibold">Your answer</label>
                    <textarea id={`answer-${question.id}`} name="body" maxLength={3000} required placeholder="Explain your answer clearly and kindly" className="min-h-24 w-full rounded-xl border border-[#DDD8EF] p-3 text-sm" />
                    <Button type="submit" size="sm">Post answer</Button>
                  </form>
                )}
              </div>
            </div>
          </Card>
        )) : (
          <Card className="p-8 text-center">
            <h2 className="font-bold text-[#35216B]">No matching questions</h2>
            <p className="mt-2 text-sm text-[#77758A]">Try different filters, or ask the first question about a topic.</p>
          </Card>
        )}
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-bold text-[#35216B]">Ask a question</h2>
        <form action={createCommunityQuestionAction} className="mt-4 space-y-3">
          <input type="hidden" name="returnTo" value="/dashboard/community/questions" />
          <label htmlFor="questionTitle" className="block text-sm font-semibold">Question</label>
          <input id="questionTitle" name="title" maxLength={180} minLength={5} required placeholder="What would you like to understand?" className="h-11 w-full rounded-xl border border-[#DDD8EF] px-3 text-sm" />
          <label htmlFor="questionSubject" className="block text-sm font-semibold">Subject</label>
          <input id="questionSubject" name="subject" maxLength={80} required placeholder="e.g. Mathematics" className="h-11 w-full rounded-xl border border-[#DDD8EF] px-3 text-sm" />
          <label htmlFor="questionTopic" className="block text-sm font-semibold">Topic (optional)</label>
          <input id="questionTopic" name="topic" maxLength={100} placeholder="e.g. Fractions" className="h-11 w-full rounded-xl border border-[#DDD8EF] px-3 text-sm" />
          <label htmlFor="questionBody" className="block text-sm font-semibold">More context</label>
          <textarea id="questionBody" name="body" maxLength={3000} required placeholder="Share what you have tried so far." className="min-h-28 w-full rounded-xl border border-[#DDD8EF] p-3 text-sm" />
          <p className="text-xs text-[#77758A]">Do not include contact or private information.</p>
          <Button type="submit" className="w-full">Post question</Button>
        </form>
      </Card>
    </div>
  );
}

function ReportForm({
  targetType,
  targetId,
}: {
  targetType: "question" | "answer" | "comment";
  targetId: string;
}) {
  return (
    <details>
      <summary className="cursor-pointer text-xs font-semibold text-[#77758A]">Report</summary>
      <form action={reportCommunityContentAction} className="mt-2 flex flex-col gap-2">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="returnTo" value="/dashboard/community/questions" />
        <textarea name="reason" maxLength={500} required placeholder="Briefly describe the concern" className="min-h-16 rounded-lg border border-[#DDD8EF] p-2 text-sm" />
        <Button type="submit" variant="secondary" size="sm">Send report</Button>
      </form>
    </details>
  );
}
