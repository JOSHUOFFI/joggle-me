# Testing Strategy

## 1. Test levels

### Unit tests: Vitest

Test pure domain logic:

- Validation schemas
- Marking rules
- Deadline calculations
- Topic score aggregation
- XP and streak rules
- Retry classification
- AI JSON validation
- Entitlement rules

No unit test should require production credentials or networks.

### Integration tests

Use controlled local or test Supabase services:

- Authentication sessions
- RLS isolation
- Profile and document repository behavior
- Job state transitions
- Storage signed URLs
- Provider adapter contract with fixtures
- API route authorization

### Contract tests

- API DTO and error schema
- AI canonical provider response
- Background job payload
- Database migration and RLS helpers

### End-to-end: Playwright

Run critical journeys in Chromium and responsive viewports:

- Registration/login/profile
- Upload/status/reprocess
- Quiz configuration/generation
- Start/answer/autosave/recovery/submit
- Results/history
- Owner authorization and audit

Test desktop, tablet, and mobile viewports. Default browsers begin with Chromium; cross-browser expansion is required before launch.

### Accessibility

- Automated axe-style checks
- Keyboard navigation
- Focus management
- Screen-reader labels
- Contrast and reduced motion
- 200% zoom
- Timer/alert announcements

## 2. Security testing

- RLS positive and negative tenant tests
- Owner role escalation tests
- Signed URL expiry and ownership
- CSRF/CORS/rate-limit tests
- Secret scanning
- Dependency/SAST scanning
- Upload signature, traversal, decompression, and parser abuse
- Prompt injection and provider output injection
- Session revocation and MFA/step-up when implemented

## 3. AI test fixtures

Maintain a private or allowed fixture set containing:

- Known facts and source sections
- Incorrect, ambiguous, and unsupported claims
- Multiple question types
- Malformed provider JSON
- Near-duplicate questions
- Hallucinated citations
- Prompt-injection text
- Mixed languages

Assess provider-specific and model-specific tests on upgrade.

## 4. Performance testing

- API read/write p95/p99 targets
- Upload acknowledgement
- Queue throughput
- Provider concurrency and backoff
- Attempt autosave/concurrency
- Database query plans for owner and user views
- Load test after implementation of each heavy flow

## 5. Reliability testing

- Refresh/disconnect/reconnect
- Duplicate submission
- Worker crash/retry
- Provider outage
- Queue dead-letter/replay
- Database outage behavior
- Signed URL expiry
- Restore from backup

## 6. Test environments

- Local test services for unit and integration.
- Ephemeral preview for pull requests.
- Dedicated test Supabase project with synthetic data only.
- Staging Supabase project and provider keys with rate/cost limits.
- Production, with no test accounts or synthetic data mixed into real data.

## 7. Quality gates

| Phase | Minimum gate |
|---|---|
| Pull request | Unit, integration, type-check, lint, secret/dependency scan |
| Feature merge | Relevant Playwright, RLS/security test, migration review |
| Pre-staging | Full regression, accessibility, load smoke, provider fixture suite |
| Pre-production | Security review, restore test, cost/alert test, approval checklist |

## 8. Test data

- Use synthetic, anonymised fixtures only.
- Never copy production student or owner data into test environments.
- Generate deterministic fake identities and documents.
- Purge test exports and uploads.
- No real AI costs in routine unit tests.
