# Product Requirements

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

## 2. Users and roles

### Initial roles

- **Learner:** Owns a profile and learning data, uploads materials, generates quizzes, and takes examinations.
- **Owner:** JoLight Technologies privileged operator. Performs platform-wide administration and feature control.
- **Support:** Future least-privileged operational role, not equivalent to Owner.
- **School administrator:** Reserved for a later authorised role; no permissions are implied in Phase 0.

Role membership must be stored separately from publicly editable profile data and must be enforceable on the server. Ordinary users must never be able to change roles.

## 3. Core requirements

### 3.1 Accounts

- Register and authenticate with Supabase Auth.
- Manage a profile and lawful personal information.
- View learning history.
- Manage uploaded materials.
- View examination attempts and results.
- Provide consent and privacy choices required for the user's jurisdiction.
- Request deletion or export of account data once implementation begins.

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

### 3.7 Owner portal

The owner portal must eventually provide authorised views and actions for:

- Platform and registration statistics.
- Lawfully collected user registration/contact information.
- Account and feature status management.
- Platform feature flags and capability controls.
- AI, document, and quiz usage monitoring.
- Role and permission management.
- Administrative audit logs.
- System health and operational indicators.

All privileged actions require server-side authorization, step-up authentication for sensitive operations where available, and audit logs.

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
