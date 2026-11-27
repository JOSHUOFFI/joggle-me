# Supabase local setup

This project does not require or execute production database changes during Phase 1 development.

## Prerequisites

- Supabase CLI
- A local or isolated development Supabase project
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` only for server administrative tooling

## Apply migrations locally

```powershell
supabase start
supabase db reset
```

The migration under `supabase/migrations/` creates the Phase 1 profiles, roles, consent, feature flags, audit log, RLS policies, and owner RPC foundations.

## Initial owner provisioning

Owner assignment is intentionally never exposed through registration or browser code.

1. Create and verify a normal account through Supabase Auth.
2. Obtain that account's UUID.
3. Set `INITIAL_OWNER_USER_ID` on the local provisioning environment only.
4. Run the provisioning operation through a server or SQL environment with the Supabase **service-role** context.
5. Call `public.provision_initial_owner('<user-id>'::uuid)`.
6. Remove `INITIAL_OWNER_USER_ID` and the service-role key from the application environment as soon as provisioning is complete.

The SQL function refuses public, anonymous, and authenticated execution and only allows the service role. It also refuses to assign a second owner.

Do not configure a hardcoded owner email or password. Never run owner provisioning against production until an explicit production runbook and break-glass recovery process are approved.
