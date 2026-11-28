# Database schema

Supabase provides PostgreSQL and private Storage. The account-based migration
history is retained for database version tracking, but the current schema has
no application profile, identity-link, role, consent, administrative audit,
or editable feature-flag tables. The cleanup migration is
[`20261128120000_anonymous_guest_workspaces.sql`](../supabase/migrations/20261128120000_anonymous_guest_workspaces.sql).

## Guest workspace ownership

`public.guest_workspaces` contains the workspace UUID, optional display name,
SHA-256 token hash, activity timestamps, and inactivity expiry. Legacy owner
UUIDs are retained as tokenless workspace rows so existing learning foreign
keys and Storage paths remain valid. A tokenless legacy workspace cannot be
resolved by a new browser capability.

Server code sends the token hash to
`public.resolve_guest_workspace(text)` using the server-only Supabase service
role. The database returns the workspace UUID only for a valid, live token.
Learning queries must include that UUID as their owner filter. Database
triggers reject missing/expired workspace owners and enforce usage limits.
Direct public/anon/authenticated grants and policies have been removed.

## Preserved learner data

Learning documents, extracted sections, quizzes, examination attempts,
performance and community tables remain in PostgreSQL. Their owner foreign
keys now reference `guest_workspaces`. The private `learning-materials` bucket
and its existing objects remain in Storage. Do not delete legacy rows solely
because their former account identity was removed.

## Integrity checks

Run the read-only
[`auth-decommission-integrity.sql`](../supabase/reports/auth-decommission-integrity.sql)
against the verified development project. The post-migration result is
recorded in [`AUTH_DECOMMISSION_REPORT.md`](./AUTH_DECOMMISSION_REPORT.md).

The managed Supabase `auth` schema and provider service remain platform-owned;
the application has no code dependency on them. The hosted provider settings
were not changed. A Storage-aware expiry endpoint and Vercel schedule exist,
but deployment and `CRON_SECRET` configuration are still required to activate
cleanup.
