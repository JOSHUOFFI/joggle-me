# Supabase database

Supabase provides PostgreSQL and private Storage. The application accesses it
from server code with the service role; that key must remain server-only.
Application sign-in, user profiles, roles, and owner administration have been
removed. Guest workspace capabilities are stored as SHA-256 hashes in
`public.guest_workspaces` and resolved only by a server-only RPC.

## Local setup

Set `NEXT_PUBLIC_SUPABASE_URL` to the development project URL and
`SUPABASE_SERVICE_ROLE_KEY` to its server-only key. Check that the URL's project
reference is the intended development project before running the app or tests.
Do not put credentials in client code, `NEXT_PUBLIC_*` variables, source files,
or test output.

## Migrations

The migration history includes earlier account-based schema migrations because
they are part of the database's applied history. The forward migration
`20261128120000_anonymous_guest_workspaces.sql` removes the account schema,
retargets learning ownership to guest workspaces, removes the old Auth user
records, and preserves learning rows and private Storage objects. It cannot
restore deleted account identities or credentials; see
[`docs/AUTH_DECOMMISSION_REPORT.md`](../docs/AUTH_DECOMMISSION_REPORT.md).

Use `supabase/reports/auth-decommission-integrity.sql` for the read-only
post-migration integrity checks. It contains no mutation statements.
