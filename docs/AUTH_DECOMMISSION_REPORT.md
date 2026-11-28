# Authentication Decommissioning Report

## Pre-execution inventory

Development target verified by Supabase CLI as `joggle-me-dev`, project ref `ppdqtaxjptktvkmpjghs`. The CLI printed an environment label of `production`; the explicit project ref and project name match the user-authorized development target. No command was directed to production ref `ggnzccklgllzjwqnmqvp`.

The inventory was read-only. It included exact row counts for application identity, learning, community, owner, and Supabase Auth tables; every foreign key referencing `auth.users`; all public and Storage policies; Auth/account/owner database routines; feature-flag values; and Storage object counts. The executable inventory query is [auth-decommission-inventory.sql](../supabase/reports/auth-decommission-inventory.sql).

| Object | Rows before cleanup | Planned action |
| --- | ---: | --- |
| `auth.users` | 2 | Delete; cascades to Auth-owned records |
| `auth.identities` | 2 | Delete by cascade |
| `auth.sessions` | 27 | Delete by cascade |
| `auth.refresh_tokens` | 284 | Delete by cascade |
| `public.profiles` | 2 | Drop; owner UUIDs copied to tokenless legacy workspaces |
| `public.clerk_identity_links` | 0 | Drop |
| `public.user_roles` | 3 | Drop |
| `public.user_consents` | 0 | Drop |
| `public.administrative_audit_logs` | 4 | Drop |
| `public.feature_flags` | 13 | Drop; current values moved to static configuration |
| `public.feature_flag_rules` | 0 | Drop |
| Learning documents | 1 | Preserve and retain original owner UUID |
| Extracted document sections | 41 | Preserve and retain original owner UUID |
| Learning quizzes, exam attempts, recommendations | 0 each | Preserve tables and retarget ownership |
| Gamification rows | 0 | Preserve tables and retarget ownership |
| Community rows | 0 in each inventoried table | Preserve tables and retarget ownership |
| `learning-materials` Storage objects | 1 | Preserve; object key and bucket remain unchanged |

The preflight found public foreign keys from profiles, account/admin tables, learning documents and sections, quizzes, attempts, performance/gamification tables, and community ownership tables to `auth.users`. Supabase-managed Auth tables also reference `auth.users` (identities, sessions, MFA, OAuth, one-time token, SCIM, and WebAuthn records). The migration retargets surviving application ownership FKs to `guest_workspaces`, drops the account/admin tables, then deletes the two Auth users so provider-owned records cascade.

The public policy inventory contained account/role/consent/feature policies, learner ownership policies on learning and performance tables, community learner/moderator policies, and two private-storage policies. The planned migration drops application policies and direct `anon`/`authenticated` table and function grants; server-side service-role operations remain the only application data path.

The routine inventory included account/role helpers (`is_account_active`, `get_my_roles`, `has_role`, `is_platform_owner`, `has_platform_authority`), new-user and owner provisioning/administration functions, owner community moderation/listing routines, and learner document/examination/community routines that used auth claims. Account/owner routines are removed. Learner operations are retained behind service-role-only guest capability wrappers and a workspace activity helper.

Feature values found: enabled `ai_document_analysis`, `ai_quiz_generation`, `examination_functionality`, and `learning_material_uploads`; disabled `community_enabled`, `community_notifications_enabled`, `community_posts_enabled`, `community_questions_enabled`, `study_groups_enabled`, `gamification`, `social_learning`, and `school_administration`; enabled `user_registration` (removed because account registration is obsolete). Learning feature values are preserved in application configuration.

## Migration and consequences

`20261128120000_anonymous_guest_workspaces.sql` creates guest workspaces, retains each old owner UUID so learner rows and storage paths do not change, retargets all surviving owner foreign keys, removes account/role/consent/admin/feature-flag structures and their dependent routines, deletes the existing Auth users and cascaded identity/session records, and asserts that learning rows have valid owners afterward.

Legacy profile UUIDs become workspaces without capability tokens. The existing browser sessions cannot be safely converted after deleting their Auth records, so those learning records remain intact but will not automatically appear in newly created guest workspaces. A secure, authenticated pre-cutover token handoff would have been required for uninterrupted access; no email or other external delivery is authorized. These legacy workspaces expire after 90 days and must be included in retention cleanup.

New guest workspaces use a 256-bit random HttpOnly cookie. The database stores only its SHA-256 hash. Server code resolves that hash through a service-role RPC and scopes learner operations to the resulting workspace UUID. Database triggers enforce 5 uploads/day and 20 total materials, 20 generated quizzes/day and 100 total quizzes, and 50 exam attempts/day. Workspace data expires after 90 days without activity.

The local Supabase CLI configuration no longer contains an `[auth]` provider
section. Supabase-managed `auth` schema and Auth service objects remain
platform-owned; they were inventoried and left intact to avoid damaging
Postgres, Storage, or Supabase administration.

## Rollback limits

The SQL migration is intended to run atomically. If any preflight, dependency, or post-migration integrity assertion fails, the transaction must abort and the database should remain unchanged. Once committed, guest schema and owner-FK changes can be reversed by a new migration, and learning data remains in place. The deleted email identities, passwords/credentials, Auth identity links, sessions, refresh tokens, profiles, three role rows, four admin audit rows, and thirteen editable feature rows cannot be reconstructed from this migration. Restoring those records would require a pre-migration Supabase backup or point-in-time restore. Restoring Auth users would reintroduce the authentication infrastructure being decommissioned.

The migration does not delete the private learning object. If an application rollback is attempted, retain guest ownership and capability validation until a reviewed reverse migration exists; do not restore the old auth policies or expose the storage bucket publicly.

## Post-execution report

The guarded migration applied to `joggle-me-dev` / `ppdqtaxjptktvkmpjghs` on
2026-11-28. No migration or application database command targeted
`ggnzccklgllzjwqnmqvp`. The CLI labels the authorized project environment
`production`; its project name and reference matched the user-specified dev
target, and every remote command used an exact-reference guard.

The read-only integrity query is
[`auth-decommission-integrity.sql`](../supabase/reports/auth-decommission-integrity.sql).
It reported zero Auth users, identities, sessions, refresh tokens, public
foreign keys to `auth.users`, public policies, and Storage policies. The
profiles, identity-links, roles, consents, admin-audit, and editable feature
tables are absent. The 67 capability workspaces created by browser tests were
reviewed and removed. The two tokenless legacy workspaces remain, including
the owner of genuine learning data. The one learning document, all 41 document
sections, and the one private `learning-materials` object remain; there are no
quizzes, attempts, or orphaned rows.

**Authentication removal is incomplete.** The hosted Supabase Auth service
and its provider configuration remain platform-managed and may still accept
provider requests. No Management API credential or linked deployment
configuration was available, and no deployment was performed. The local
`supabase/config.toml` contains no Auth provider section. `.env.local` now has
no Clerk assignments or unused Supabase publishable key. No production
project was accessed.

The Clerk key values were inadvertently exposed in an earlier local search
output during this work. The values are not reproduced here. Treat both keys
as compromised and revoke/rotate them in Clerk; this workspace has no Clerk
dashboard access, so revocation is not verified. Deployment environment
variables were not inspected or changed because no deployment project was
linked and no deployment configuration credential was available.

The Supabase Auth client SDK has been removed from `package.json`, the lockfile,
and `node_modules`. The application uses only the direct PostgREST and Storage
SDK packages. Its code has no Clerk calls, Supabase Auth calls, `auth.uid()`
references, account profile or role dependencies, or login/registration
routes. The applied Clerk identity-link migration was marked reverted in the
dev migration ledger and its source file removed. The remaining older account
schema migrations are retained as migration history for database replay; the
guest cleanup migration removes those account objects before application use.

The browser suite verified guest workspace creation, HttpOnly capability
cookies, and independent display-name settings in two separate browser
contexts. A PostgREST schema-cache refresh was needed to expose the new RPCs.
This verifies application-level isolation for settings; broader adversarial
testing of every learning-data API remains outstanding.

The current 90-day inactivity expiry prevents a guest capability from
resolving after expiry. A Storage-aware cleanup endpoint and daily Vercel cron
configuration have been added in `src/app/api/cron/guest-workspace-retention`
and `vercel.json`; the endpoint removes private Storage objects before deleting
expired workspaces and their cascading learning rows. `CRON_SECRET` must be
configured in the deployment environment, and the schedule is not active until
the application is deployed. No deployment was performed, as instructed. The
cookie is issued for one year while the database expiry rolls forward on
activity.

The first two migration attempts aborted atomically on dependencies and made
no changes. Migrations `20261128120000`, `20261128130000`, and
`20261128140000` then applied successfully. A post-migration integrity query
passed with the counts above, including zero application function references
to `auth.uid()`, profiles, roles, or removed account helpers.

### Verification results

- `npm run test`: 43 passed after removing the bundled Supabase Auth SDK.
- `npm run typecheck`: passed after switching to direct PostgREST/Storage
  clients.
- `npm run lint`: passed with no warnings.
- `npm run build`: passed after the direct SDK replacement.
- `npx playwright test --workers=1`: 12 passed after the direct SDK
  replacement, including guest startup and two-context settings isolation.
- Database integrity query: passed for Auth row deletion, learning-data
  preservation, no orphans, no public Auth FKs/policies, and private Storage.
- Cross-workspace browser settings isolation: verified in two fresh contexts.
- Full hostile cross-tenant API matrix: not run.

The 67 original Playwright workspaces, six focused-test workspaces, and 13
final-suite workspaces were reviewed as empty test artifacts and removed with
count and ownership assertions. The final workspace count is two; all genuine
learning rows remain attached to the tokenless legacy workspace.

The destructive database migration is committed remotely and deleted Auth
identities cannot be recovered by rolling back application code. Recovery of
the deleted identities requires a pre-migration backup or point-in-time
restore, which would restore account infrastructure and is not recommended.
