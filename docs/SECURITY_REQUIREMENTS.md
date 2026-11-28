# Security requirements

## Guest workspace isolation

- Workspace capabilities must be unpredictable, at least 256 bits, and held
  only in an HttpOnly, SameSite cookie.
- Store only a cryptographic hash of the capability in the database.
- Resolve and authorize workspace access in server-only code. Never accept a
  workspace UUID or role from a caller as proof of ownership.
- Scope every learner-data query and mutation to the resolved workspace.
- Keep the Supabase service-role key in server-only configuration and modules.
- Enforce workspace ownership and usage limits in the database as well as the
  application.
- Reject expired or malformed capabilities and avoid exposing whether another
  workspace exists.

## Learning materials and data

- Keep the `learning-materials` bucket private and check workspace ownership
  before issuing read, write, or delete operations.
- Validate upload type, size, content hash, and generated object key.
- Preserve existing learning records during account removal; do not silently
  attach legacy data to a new browser workspace.
- Delete expired workspace data and private Storage objects together. The
  cleanup endpoint and Vercel schedule are prepared; `CRON_SECRET` and a
  deployment are still required to activate them.

## Environment and project boundaries

- Do not place secrets in client bundles, `NEXT_PUBLIC_*` variables, source
  files, or logs.
- Verify the Supabase project reference before any remote operation. Production
  project `ggnzccklgllzjwqnmqvp` is off-limits for this decommission.
- Do not deploy without explicit authorization.
- Supabase-managed Auth internals remain platform-owned. Do not drop or modify
  the `auth` schema; the application must not call its provider APIs or helper
  functions. See the decommission report for current settings.
