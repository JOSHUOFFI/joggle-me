# Security Requirements

## 1. Security objectives

- Protect confidentiality and integrity of learning materials, attempts, results, private profile data, and answer keys.
- Prevent unauthorised cross-user access.
- Prevent privilege escalation.
- Establish traceability for owner and operator actions.
- Safely process untrusted files and AI output.
- Minimise and protect data for minors.

## 2. Authentication

- Use Supabase Auth with secure, HTTP-only session handling.
- Require verified email or an approved alternative before sensitive operations.
- Use password best practices and provider MFA when available.
- Add MFA or step-up authentication for owner actions that alter accounts or platform-wide settings.
- Add rate limiting for login, password reset, registration, quiz generation, uploads, and submissions.
- Revoke sessions for account compromise or role removal.
- Rotate provider and service credentials on separation or suspected compromise.

## 3. Authorisation

- Central role/permission model with owner privilege and least privilege.
- Owner role separate from profile fields and only assigned by a server-supervised process.
- `learner` cannot grant owner, support, or school-administrator roles.
- Server-side checks on every privileged route, RPC, server action, and background job.
- RLS on all tenant and privileged tables.
- Deny by default.
- Object ownership checks before signed URLs are issued.
- Preview/feature environments must not use production identity or data.

## 4. Owner privileges

Owner actions must be:

- Explicitly named and allowlisted.
- Re-authorised for sensitive operations.
- Logged in immutable or append-only audit records.
- Rate limited.
- Restricted to the owner service role and protected server endpoints.
- Separated from ordinary profile editing.

Owner APIs must not accept `role=owner` or equivalent from a client.

## 5. Secrets

- Store secrets in Vercel and Supabase secret managers.
- `.env.example` may contain names only, never real credentials.
- Never commit `.env`, private keys, service-role keys, or provider keys.
- Browser code may contain only publishable Supabase configuration and explicitly public values.
- Use separate keys per environment.
- Define ownership and 90-day maximum rotation target unless provider policy requires faster.
- Remove logs and artifacts containing secrets.

## 6. File security

- Allowlist formats and MIME types; verify file signatures, not filenames alone.
- Set maximum size, page, word, image, and decompression limits.
- Quarantine uploads before extraction.
- Generate server-side malware scans when available.
- Never execute uploaded files or use unsafe parsers in privileged processes.
- Block archive traversal and encrypted, macro-enabled, or script-capable formats during initial release.
- Store objects with private access and short-lived signed URLs.
- Strip or retain metadata under an explicit privacy policy.
- Delete objects and derived text according to account deletion and retention policy.

## 7. API protection

- Validate all request bodies with strict schemas.
- Limit payload sizes and multipart uploads.
- Use CSRF protection for cookie-authenticated mutations.
- Apply origin checks and CORS allowlists.
- Apply per-user, per-IP, and per-route rate limits.
- Use idempotency keys for uploads, submissions, and generation.
- Never return answer keys with learner-facing quiz payloads.
- Use correlation IDs and redacted server logs.
- Standardize errors without internal details or stack traces.

## 8. AI security and validation

- User documents are untrusted data; prompt injection must not cause tool or privilege changes.
- AI providers receive only approved document content and prompts.
- Provider output is untrusted.
- Validate JSON shape, question count, options, answer key, explanation, source references, and question type.
- Verify answer-key correctness through independent deterministic checks where possible.
- Reject unsupported formatting and unclear citations.
- Never include system prompts, provider keys, or hidden answer-key context in browser responses.
- Prevent cross-document retrieval or generation using RLS and server-issued document scope.
- Record provider/model/prompt versions and usage.

## 9. Data privacy

- Map lawful basis and consent per purpose and jurisdiction.
- Minimise profile and child data.
- Separate public profile data from private contact data.
- Implement data export and deletion workflows.
- Define retention for source files, extracted text, jobs, analytics, audit logs, and backups.
- Encrypt at rest by managed platform controls and TLS in transit.
- Avoid AI provider data retention or training unless explicitly approved and contractually prohibited from training, with no minors' content unless specifically approved.
- Sanitize analytics and crash reports.
- Conduct a minors/safeguarding review before social features.

## 10. Audit logging

Audit privileged and security-sensitive events:

- Role grants/revokes
- Account status changes
- Feature enable/disable
- Profile contact access
- Data export/deletion
- Storage key access
- Attempts to exceed entitlements
- Login anomalies
- Admin and owner session changes
- AI/provider configuration changes

Audit metadata must be allowlisted and exclude secrets, full answer data, and unconsented raw documents.

## 11. Incident response

- Document severity levels and response contacts.
- Add kill switches for uploads, AI generation, messaging, and privileged integrations.
- Preserve evidence and audit events.
- Define credential compromise, data breach, child safety, and malicious AI output procedures.
- Test a restore and owner account recovery scenario before launch.

## 12. Security testing

- Threat modelling per feature.
- SAST, dependency scanning, secret scanning, and container/file parser scanning.
- RLS isolation tests.
- Owner escalation tests.
- Upload and provider abuse tests.
- CSRF, CORS, rate limiting, and session tests.
- AI prompt-injection and output-validation tests.
- Annual/periodic penetration test before and after significant launches.
