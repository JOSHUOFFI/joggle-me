# System Architecture

## 1. Architectural style

JOGGLE ME should use a modular monolith for the initial implementation, deployed as a Next.js application with clearly separated domain modules. This avoids premature microservices while preserving provider-independent boundaries and future extraction of heavy processing jobs.

Recommended modules:

- Identity and profiles
- Material ingestion
- Document processing
- AI quiz generation
- Examination
- Results and performance
- Gamification
- Owner administration
- Entitlements and usage
- Future social capabilities

## 2. Technology evaluation

| Choice | Recommendation | Rationale |
|---|---|---|
| Next.js App Router | Adopt | Server actions, route handlers, server components, metadata, and middleware fit one deployable product. |
| TypeScript | Adopt with strict mode | Shared types reduce contract and data-model drift. |
| Tailwind CSS | Adopt | Suitable responsive design system and consistent utility constraints. |
| shadcn/ui | Adopt | Accessible primitives and local ownership; do not treat generated components as a runtime dependency. |
| Supabase PostgreSQL | Adopt | Managed PostgreSQL with RLS, Auth, Storage, and a clear migration path. |
| Supabase Auth | Adopt initially | Integrates with PostgreSQL RLS and reduces custom credential/security work. |
| Supabase Storage | Adopt initially | Private buckets and signed URLs fit document storage. Keep storage behind a repository/service interface. |
| Gemini | Adopt as initial provider | First implementation is cost/time efficient if integrated only behind an AI provider port. |
| Background processing | Adopt | Extraction and generation are long-running and must not consume web request lifetimes. Supabase queues or a small managed worker platform may be used. Final queue selection is a Phase 1 approval decision. |
| Vitest | Adopt | Fast unit and integration testing for TypeScript. |
| Playwright | Adopt | Cross-browser and responsive end-to-end testing. |
| GitHub | Adopt | Source control, reviews, branch protection, issues, and release automation. |
| Vercel | Adopt for web deployment | Native Next.js support and preview environments; database/storage remain separately managed. |

Add a queue abstraction rather than coupling domain code to Vercel cron or one queue vendor. Initial worker execution may use Supabase Edge Functions only after a production-ready queue timeout, retry, observability, and replay design is selected.

## 3. Request architecture

- Browser to Next.js route handlers or server actions for application requests.
- Server components for reads that do not need client state.
- Server-only services for role checks, database access, signed storage URLs, AI calls, and answer-key marking.
- PostgreSQL as the system of record.
- Supabase Auth issues authenticated identities.
- RLS provides data isolation in direct and application database access.
- Central authorization helpers must also enforce privileged operations, because UI hiding alone is insufficient.

Do not expose service-role credentials to browser code or public environment variables.

## 4. Background processing

Recommended job flow:

1. API creates a job row and stores an immutable request snapshot.
2. Job is queued with an idempotency key.
3. Worker claims it atomically.
4. Worker performs extraction or generation.
5. Worker writes versioned artifacts and status transitions.
6. Worker emits an audit/usage event.
7. API exposes status and retryable failure information.

For the initial Phase 2 deployment, a database-backed document status is the
durable work record. The upload route acknowledges the private storage write,
then schedules extraction and analysis with Next.js `after()`. Failures remain
visible and can be retried by the owning learner. A dedicated queue/worker is
deferred until processing volume or hosting duration limits require it.

Jobs must support:

- Retry with bounded exponential backoff.
- Dead-letter/manual review states.
- Cancellation.
- Idempotency and reprocessing.
- Correlation IDs.
- Provider response logging without answer-key or secret leakage.

## 5. Storage

Use private Supabase buckets or storage-compatible private objects. Store objects by opaque keys derived from user/document IDs, not original filenames. Only server-side signed URLs should be issued, with short expiry and audit logging.

Store content text and extracted chunks in PostgreSQL with document lineage. Large binary objects remain in object storage.

## 6. AI integration

Define ports for:

- Text extraction
- Embedding/retrieval (if used)
- Text generation
- Structured-output validation
- Usage accounting

Gemini is an implementation adapter. Provider/model selection must be configuration and database data, not module rewrites.

## 7. Data flow

### Document generation

Upload -> malware/format validation -> object storage -> extraction job -> structured text/chunks -> topic analysis -> quiz-generation request -> provider adapter -> schema/grounding validation -> publish draft -> learner starts attempt.

### Attempt flow

Create attempt -> server issues deadline -> autosave answers -> submission/final deadline -> mark -> freeze attempt -> calculate performance -> return result.

## 8. Extensibility

Future monetisation, social features, and provider additions must be behind stable ports. Do not embed role names or provider-specific response formats in UI components or controllers.

## 9. Non-functional targets

Targets require load validation before production:

- Web p95 server response below 500 ms for non-AI reads at expected load.
- Document upload acknowledgement within 2 seconds.
- AI generation jobs do not block web requests.
- Zero cross-tenant data access.
- Recovery of an open attempt after refresh or brief disconnection.
- RPO 24 hours or tighter and RTO 4 hours or tighter, subject to Supabase plan and final owner approval.

## 10. Major risks

- Unsafe file processing
- Extraction quality and PDF/DOCX format diversity
- Hallucinated or weakly grounded questions
- Answer-key exposure
- Time manipulation or duplicate submissions
- Cost spikes from AI calls
- Supabase/vendor lock-in
- Minors and sensitive data compliance
- Social moderation scope if started early
