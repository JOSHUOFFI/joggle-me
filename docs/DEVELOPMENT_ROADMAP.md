# Development Roadmap

> Historical plan: its account, authentication, profile, and Owner portal
> milestones were superseded by anonymous guest workspaces. See
> [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) and the
> [decommission report](./AUTH_DECOMMISSION_REPORT.md) for the current design
> and remaining verification work.

## Phase 0: Architecture and product foundation

### Objectives

Create a reviewed product, technical, security, database, AI, design, testing, and deployment foundation.

### Acceptance criteria

- All 12 required Phase 0 documents exist.
- Architecture choices are justified.
- Database entities, ownership, RLS, and indexes are documented.
- Security, AI, API, and accessibility requirements are explicit.
- No application code, migration, secret, database connection, or deployment is added.
- Owner approval is obtained before implementation.

### Testing

- Documentation review.
- Schema/design peer review.
- Link and formatting check.
- Security threat-model review.

## Phase 1: Application foundation, authentication, profiles, and owner portal

### Scope

Next.js foundation, Tailwind/shadcn, strict TypeScript, auth, profiles, server authorization, initial owner portal, audit logging, CI.

### Acceptance criteria

- Learner can register, verify, log in, recover password, update profile, and delete/export request.
- Learner can view an empty learning history safely.
- Owner can be assigned only through protected server tooling.
- Owner portal is inaccessible to learners.
- RLS blocks cross-user profile access.
- Base CI and preview environments are available.

### Testing

- Vitest unit/integration.
- Playwright auth and profile journeys.
- RLS tests.
- Role escalation tests.
- Accessibility automated checks.
- Mobile/desktop responsive smoke tests.

## Phase 2: Learning material uploads and AI document analysis

### Scope

Private uploads, format validation, quarantining, extraction jobs, statuses, text/chunks, topic identification, lifecycle/deletion.

### Acceptance criteria

- PDF, DOCX, and TXT support follows the approved format matrix.
- Cross-user file access is impossible.
- Oversized and malformed uploads are rejected.
- Extraction status, retries, and failure are visible.
- Source locations are preserved.
- Uploaded/processing/ready/failed lifecycle is tested.

### Testing

- Format fixtures and parser integration.
- MIME/signature and size tests.
- Object ownership/RLS tests.
- Retry/dead-letter tests.
- XSS-safe text rendering.
- Security scan for parsers and uploads.

## Phase 3: AI quiz generation and configuration

### Scope

Generation configuration, provider adapter, prompt versioning, retrieval, validation, answer verification, usage metering.

### Acceptance criteria

- Learner can generate 20 mixed-difficulty questions for a 30-minute examination in the default scenario.
- Every published question passes schema and source-grounding validation.
- Answer keys/explanations/source references are present.
- Invalid provider output is rejected.
- Gemini can be changed without domain-layer provider rewrites.
- Generation limits and usage events are enforced.

### Testing

- Fixture grounding suite.
- JSON/schema validation.
- Hallucination/prompt injection.
- Answer-key correctness.
- Provider outage/retry.
- Cost accounting.

## Phase 4: Examination engine

### Scope

Attempt lifecycle, server deadlines, autosave, navigation, submission, automatic marking, recovery, answer-key protection.

### Acceptance criteria

- Countdown and server deadline agree under normal network conditions.
- Answers autosave and recover after refresh/disconnection.
- Submission is idempotent.
- Expired attempts cannot continue and submit.
- Answer key is absent from learner quiz payloads and logs.
- Automatic marking is deterministic and versioned.

### Testing

- Browser clock manipulation tests.
- Refresh/disconnection/reconnect tests.
- Concurrent and duplicate submission.
- Deadline boundary tests.
- RLS and answer-key access tests.
- Marking fixtures.

## Phase 5: Results and performance analytics

### Scope

Scores, explanations, topic performance, attempt history, strengths, weaknesses, recommendations.

### Acceptance criteria

- Correct/incorrect answers and explanations are accurate.
- Topic scores reconcile to attempt marks.
- History and trends reflect finalised attempts only.
- Recommendations cite known weak topics and avoid unsupported claims.

### Testing

- Marking-to-result reconciliation.
- Analytics fixtures.
- Date/timezone tests.
- Accessibility of charts and tables.
- Cross-user privacy tests.

## Phase 6: Gamification

### Scope

XP, levels, badges, achievements, streaks, daily challenges, rewards.

### Acceptance criteria

- XP and achievements are event-driven and idempotent.
- Replay of events cannot duplicate rewards.
- Streak logic has documented timezone rules.
- Gamification can be disabled by feature flag.

### Testing

- Domain-event replay.
- Timezone/day-boundary.
- Duplicate and out-of-order events.
- Flag/entitlement controls.

## Phase 7: Social learning

### Scope

Optional, feature-flagged community participation with:

- A paginated learner feed with posts, comments, replies, and reactions.
- Subject/topic questions and answers, including accepted answers.
- Public and private study groups with administrator-reviewed membership.
- Private-by-default community profiles with optional badge sharing.
- In-app notifications, blocking, content reports, and owner moderation.

Private messaging, contact discovery, public leaderboards, and social performance sharing are out of scope.

### Acceptance criteria

- Server and RLS enforce feature flags, learner ownership, group membership, and moderation authority.
- Public profiles expose only explicitly shared community fields; contact details and performance data remain private.
- Blocking hides interactions in both directions, and self-reports or self-review of reports are rejected.
- Owner moderation actions are audited and community suspensions do not change authentication or learning access.
- Feed and directory reads are bounded and user-generated content is validated.

### Testing

- Learner isolation, feature-flag enforcement, block/report behavior, and owner-only moderation.
- Post/comment/reaction and Q&A workflows.
- Public/private group membership and approval.
- Notification ownership and read status.
- Mobile and unauthenticated route checks.
- Explicit consent is recorded and revocable.

### Testing

- Minor safeguarding scenarios.
- Privacy and consent.
- Abuse/report/block flows.
- Moderation integration.
- Messaging security and RLS.

## Phase 8: Commercialisation readiness, security hardening, and launch

### Scope

Usage limits, plan/entitlement abstraction, future payment adapter readiness, production hardening, operational readiness.

### Acceptance criteria

- Core product remains free.
- Future subscription/payment providers require only adapter and record changes.
- Disaster recovery restore is tested.
- Security review, load test, privacy review, and launch checklist pass.
- Monitoring, alerts, kill switches, support, and rollback are proven.

### Testing

- Full regression and load test.
- Penetration test.
- Privacy/data deletion test.
- Restore and failover exercise.
- Production smoke and rollback rehearsal.
