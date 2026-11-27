# Phase 1 security verification runbook

## Environment prerequisite

The current workstation does not have Docker, PostgreSQL `psql`, or the Supabase CLI. These tools are required for migration execution and database-level RLS testing. No remote database was used.

## Install the local prerequisite

On Windows, install Docker Desktop and the Supabase CLI, then start Docker:

```powershell
npx supabase start
```

Alternative CLI installation:

```powershell
npm install --global supabase
supabase start
```

Use only a local or isolated development project. Never point this runbook at production.

## Apply the migration

```powershell
supabase db reset
```

## Run SQL security tests

After the local project is running:

```powershell
supabase db psql -f supabase/tests/phase1_security.sql
```

The test script is transactional and starts by creating development-only UUIDs. It verifies:

- Learner cannot insert administrative roles.
- Learner cannot set account status.
- Learner cannot insert audit records.
- Disabled users lose profile RLS access.
- Missing or disabled feature flags fail closed.

It is not a substitute for Supabase Auth integration tests; use separate test accounts for real login, refresh, password recovery, session suspension, and admin ban/unban scenarios.

## Test account matrix

Create separate development accounts for:

- Platform owner.
- Platform administrator.
- School administrator.
- Teacher.
- Learner.

Never reuse a production account or credentials.

## Password recovery verification (development only)

Use only the development Supabase project `ppdqtaxjptktvkmpjghs`. In its
Authentication URL Configuration, set the Site URL to
`http://127.0.0.1:3000` and allow `http://127.0.0.1:3000/**` as a redirect.
If the app is opened as `http://localhost:3000`, allow that origin as well.
Do not add production URLs while testing this flow.

For real email delivery, configure a working SMTP provider in the development
project's Authentication email settings. Keep the recovery template's link
pointing to Supabase's `{{ .ConfirmationURL }}` so Supabase verifies the
one-time recovery token before returning to the app.

With the app running locally, use a dedicated development account to request a
reset, open the email link, set a strong new password, and confirm the success
message returns to login. Verify the new password works, the old one fails, and
reopening the recovery link cannot update the password again. Also test a
malformed/expired link and confirm it offers a way to request a fresh link.
Never include account credentials or reset links in test reports.

## Required integration evidence

Record for each test:

- Test account and role.
- Request or SQL used.
- Expected result.
- HTTP status or PostgreSQL error.
- Audit record generated.
- Session status before and after suspension.

## Account suspension limitation

JOGGLE ME uses both:

1. Authoritative `profiles.account_status = 'active'` checks in application guards and RLS-dependent RPC/policy helpers.
2. Optional Supabase GoTrue `ban_duration` in the owner server action.

Status checks prevent existing sessions from continuing through application routes or RLS-protected database operations. The GoTrue ban is an additional integration where available and is not assumed as the sole enforcement mechanism.
