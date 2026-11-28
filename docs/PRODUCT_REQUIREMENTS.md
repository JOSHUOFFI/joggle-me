# Product Requirements

> **Superseded account sections:** this document predates the permanent move to
> anonymous guest workspaces. Sections describing user accounts, roles,
> registration, consent profiles, and the Owner portal are obsolete. The
> current architecture and decommission status are documented in
> [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) and
> [AUTH_DECOMMISSION_REPORT.md](./AUTH_DECOMMISSION_REPORT.md). Learning
> material, AI analysis, quiz generation, timed examinations, marking, results,
> and performance requirements remain relevant.

## 1. Product summary

JOGGLE ME combines personal learning materials with AI-generated assessment and performance intelligence. Its core loop is:

1. User registers and creates a profile.
2. User uploads approved learning material.
3. JOGGLE ME extracts and structures the material.
4. User configures an examination.
5. JOGGLE ME generates source-grounded questions for validation.
6. User completes a timed, recoverable examination.
7. JOGGLE ME marks the attempt and explains results.
8. JOGGLE ME identifies topic performance and recommends improvements.

## 2. Workspace model

Learner work is organized into anonymous guest workspaces. A random browser
capability identifies a workspace; no accounts or roles are created. Workspace
loss and retention behavior must be clear to learners. See
[`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md).

## 3. Core requirements

### 3.1 Guest workspace

- Start learning without registration.
- Keep learning history scoped to the browser-held workspace capability.
- Allow a learner to set a workspace display name.
- Define safe recovery, expiry, deletion, and export behavior before launch.

### 3.2 Learning materials

Initial approved formats should be:

- PDF
- DOCX
- TXT

The roadmap should allow an approved format allowlist. Additional formats require format-specific security and extraction requirements. The system must:

- Validate MIME type and file structure.
- Enforce upload size and page limits.
- Store files privately.
- Create an extraction status and failure detail.
- Extract text and structure.
- Identify subjects/topics where confidence is adequate.
- Preserve source locations for grounded citations.
- Permit deletion and reprocessing.
- Prevent users from seeing or processing another user's file.

### 3.3 AI quiz generation

A quiz request should support:

- 1-50 questions in the initial implementation, subject to owner limits.
- Mixed, easy, medium, or hard difficulty.
- 5-180 minute duration, subject to owner limits.
- Question types: multiple choice, true/false, short answer, and later other supported types.
- Topic selection or automatic topic selection.
- Retryable generation jobs.

Generated output must include question text, supported answer format, answer key, explanation, source reference, and confidence metadata. It must be rejected if required structure or grounding cannot be validated.

### 3.4 Examination engine

Future implementation must support:

- Server-issued attempt lifecycle and countdown end time.
- Answer selection and navigation.
- Periodic autosaving.
- Recovery after network interruption or accidental refresh.
- Automatic submission at the server-defined deadline.
- Prevention of answer-key exposure in normal browser/API responses.
- Deterministic automatic marking for supported question types.
- Immediate result delivery after finalisation.
- Idempotent submission and retries.
- Device and progress state recovery without resetting completed answers.

### 3.5 Performance intelligence

Future results must show:

- Total and per-section score.
- Correct and incorrect answers.
- Detailed explanations and source references.
- Topic-level performance.
- Strengths and weaknesses.
- Personalised, evidence-based improvement recommendations.
- Attempt history and trend summaries.

### 3.6 Gamification

The architecture reserve:

- XP transactions
- Levels
- Badges
- Achievements
- Streaks
- Daily challenges
- Reward rules

Gamification events must be derived from immutable domain events and must be idempotent.

### 3.7 Platform administration

The former Owner portal and its account, role, registration, and audit
infrastructure were removed. Deployment-level feature configuration and
operational monitoring require a separately designed server-side process.

### 3.8 Future social features

Phase 0 reserves schemas and policies for future isolated social capabilities:

- Friend requests
- Explicit-consent contact discovery
- Profiles
- Private messaging
- Study groups
- Community questions/discussions
- Achievement/performance sharing

These features are not Phase 0 deliverables. Minors require age gates, parental or guardian flows where legally required, safeguarding controls, reporting, blocking, content moderation, consent management, data minimisation, and a separate threat/privacy review before implementation.

### 3.9 Commercialisation

Phase 0 must not implement payments or paid entitlements. The model should separate:

- Feature flags.
- Entitlement checks.
- Usage meters.
- Plan and subscription records.
- Provider/payment integration behind adapters.

The initial product and all core features must be free.

## 4. Cross-cutting requirements

- Responsive desktop, tablet, and mobile experience.
- Accessible to WCAG 2.2 AA.
- Multi-language-ready copy and content, with English as initial content.
- Server-authoritative timestamps and deadlines.
- Soft-delete or retention policy for recoverable data.
- No personal data in logs or analytics unless explicitly designed and minimised.
- Fail safe: incomplete generation or submission must not publish invalid results.
- Every destructive or administrative action must have explicit confirmation and auditability.
