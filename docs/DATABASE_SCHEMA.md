# Database Schema

## 1. Schema principles

- PostgreSQL/Supabase is the system of record.
- Every tenant-owned table uses an immutable `owner_id` or `user_id` foreign key.
- Server-generated identifiers use UUIDs.
- Timestamps use `timestamptz`.
- Soft-delete fields are preferred when data may be recovered or audited.
- Financial, role, and AI usage data must be append-oriented where appropriate.
- Foreign keys use explicit `ON DELETE` behaviour; account deletion jobs must be deliberate.
- RLS is enabled on every table containing user data or privileged data.

## 2. Proposed entities

### Identity and profiles

**profiles**

- `id uuid` primary key, foreign key to `auth.users(id)`
- `display_name`
- `given_name`, `family_name`
- `avatar_url`
- `country_code`, `preferred_locale`, `timezone`
- `date_of_birth` or age-band data only if legally approved
- `onboarding_status`
- `created_at`, `updated_at`, `deleted_at`

Owner-visible contact fields belong in a separate consented table rather than general public profile data.

**user_roles**

- `id`
- `user_id`
- `role` enum (`learner`, `owner`, `support`, `school_admin`)
- `granted_by`
- `granted_at`
- `revoked_at`
- unique active role constraint

Role changes require privileged server actions and audit events.

**consents**

- `id`
- `user_id`
- `purpose`
- `version`
- `granted`
- `granted_at`
- `withdrawn_at`
- `source`

### Learning materials

**learning_documents**

- `id`
- `user_id`
- `title`
- `original_filename`
- `object_key`
- `mime_type`
- `byte_size`
- `status` (`uploaded`, `queued`, `processing`, `ready`, `failed`, `deleted`)
- `content_hash`
- `language`
- `created_at`, `updated_at`, `deleted_at`

**document_versions**

- `id`
- `document_id`
- `version_number`
- `object_key`
- `extraction_status`
- `extractor`
- `extractor_version`
- `created_at`

**document_sections**

- `id`
- `document_id`
- `position`
- `title`
- `text`
- `page_or_location`
- `language`
- `created_at`

**topics**

- `id`
- `name`
- `normalised_name`
- `parent_topic_id`

**document_topics**

- `document_id`
- `topic_id`
- `confidence`
- `source_section_id`

### Quiz and examinations

**quiz_definitions**

- `id`
- `user_id`
- `document_id`
- `title`
- `configuration_json`
- `status`
- `source_version`
- `provider`
- `model`
- `prompt_version`
- `created_at`

**quiz_questions**

- `id`
- `quiz_id`
- `question_type`
- `prompt`
- `options_json`
- `answer_key_encrypted_or_server_only_json`
- `explanation`
- `source_section_id`
- `topic_id`
- `difficulty`
- `position`
- `validation_status`
- `validation_metadata_json`

Never select answer keys in ordinary quiz/list APIs.

**quiz_attempts**

- `id`
- `user_id`
- `quiz_id`
- `status`
- `started_at`
- `submitted_at`
- `server_deadline_at`
- `remaining_seconds` should not be trusted by the client
- `attempt_number`
- `submission_source`
- `version`
- `created_at`

Unique constraint: one active attempt per user/quiz unless retries are intentionally enabled.

**attempt_answers**

- `attempt_id`
- `question_id`
- `answer_json`
- `answered_at`
- `saved_at`
- `revision`
- `client_sent_at`

Unique `(attempt_id, question_id)`. `answered_at` is server-derived or verified.

**attempt_results**

- `attempt_id` primary key
- `score`
- `max_score`
- `topic_scores_json`
- `marked_at`
- `marking_version`
- `finalised_at`

### Performance

**performance_snapshots**

- `id`
- `user_id`
- `source_attempt_id`
- `topic_id`
- `score`
- `mastery`
- `strengths_json`
- `weaknesses_json`
- `recommendations_json`
- `created_at`

### Jobs and usage

**background_jobs**

- `id`
- `owner_id`
- `type`
- `payload_hash`
- `request_snapshot_json`
- `status`
- `attempt_count`
- `max_attempts`
- `idempotency_key`
- `available_at`
- `locked_at`
- `completed_at`
- `dead_letter_at`
- `created_at`

Unique `(owner_id, idempotency_key, type)`.

**ai_usage_events**

- `id`
- `user_id`
- `provider`
- `model`
- `operation`
- `input_tokens`
- `output_tokens`
- `estimated_cost`
- `latency_ms`
- `status`
- `correlation_id`
- `created_at`

**feature_flags**

- `key`
- `enabled`
- `scope_type`
- `scope_id`
- `updated_by`
- `updated_at`

**entitlements** and **usage_limits** reserve future plan and payment capabilities without implementing subscriptions.

### Gamification

**xp_transactions**, **levels**, **badges**, **achievements**, **user_achievements**, **learning_streaks**, **challenges**, and **challenge_assignments** reserve future gamification. XP changes must be append-only and de-duplicated with a unique domain event ID.

### Community

The Phase 7 migration adds:

- **community_profiles** — opt-in display name, avatar URL, biography, interests, subjects, visibility, and a separate badge-sharing preference. Private account details and performance records are not exposed.
- **community_posts**, **community_comments**, and **community_reactions** — learner-authored feed content, one-level replies, and unique per-user post reactions.
- **community_questions** and **community_answers** — subject/topic questions, answers, and an accepted-answer reference.
- **study_groups** and **study_group_members** — public/private groups, administrator membership, and pending private-group requests.
- **community_notifications**, **community_reports**, and **community_blocks** — private in-app notifications, moderated reports, and symmetric interaction hiding.

All community tables use RLS. Server-side functions enforce feature flags, active learner status, membership, moderation, rate limits, and ownership. Community features are disabled by default until an owner enables their feature flags. Public profile data is separate from the private account profile.

### Owner and audit

**audit_events**

- `id`
- `actor_id`
- `actor_role`
- `action`
- `target_type`
- `target_id`
- `metadata_json` (allowlisted only)
- `ip_hash`
- `correlation_id`
- `created_at`

**system_feature_settings**

- `key`
- `value_json`
- `enabled`
- `updated_by`
- `updated_at`

No direct public insert/update to role or audit tables.

## 3. Relationships

- `auth.users` 1:1 `profiles`.
- A profile 1:N learning documents, quizzes, attempts, and performance snapshots.
- A document 1:N versions and sections.
- A document N:N topics through `document_topics`.
- A quiz 1:N questions.
- A quiz 1:N attempts.
- An attempt 1:N answers and 1:1 result.
- An attempt's answers reference immutable quiz question versions.
- A user N:N achievements through user achievement records.
- `background_jobs` belongs to a user or a system owner, never an arbitrary tenant.

## 4. Indexes

- `profiles.deleted_at`
- `learning_documents (user_id, status, created_at)`
- `document_sections (document_id, position)`
- `document_topics (document_id, topic_id)`
- `quiz_definitions (user_id, created_at)`
- `quiz_questions (quiz_id, position)`
- `quiz_attempts (user_id, status, server_deadline_at)`
- `attempt_answers (attempt_id, question_id)`
- `ai_usage_events (created_at, provider, status)`
- `audit_events (created_at, actor_id, action)`
- `background_jobs (status, available_at)`
- Add partial indexes for active attempts and active roles.

## 5. Row Level Security

RLS must be enabled for user-owned and privileged tables.

| Table family | Learner policy | Owner/support policy |
|---|---|---|
| profiles | Select/update own profile; no public contact fields | Owner/support as explicitly authorised |
| documents/sections/topics | CRUD own document data; no cross-user access | Owner read only for approved operations |
| quizzes/questions | Learner manages own drafts and sees published quiz; answer key excluded | Owner limited operational visibility |
| attempts/answers/results | CRUD own active attempt; answers immutable after finalised | Owner aggregate or authorised record view |
| usage/limits | Select own usage | Admin select aggregate/detail |
| roles | No client insert/update/delete | Privileged RPC only |
| audit_events | None or own export if policy requires | Owner/support read as authorised |

Use SQL helper functions such as `is_owner()` or `has_role()` based on server-set authentication context. Never rely on a caller-controlled role claim. Storage policies must match bucket ownership and document records.

All privileged mutations must use a server-side RPC or service boundary with re-checking. RLS is defence in depth, not a substitute for application authorization.
