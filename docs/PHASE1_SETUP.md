# Phase 1 setup

## Local application

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Configure:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY` only for server administrative tooling

The publishable key is browser-safe. The service-role key must never be placed in `NEXT_PUBLIC_*` variables or client modules.

## Database

See [supabase/README.md](../supabase/README.md). Local only.

Do not run migrations against production. Verify RLS and owner authorization in a development Supabase project before any production approval.

## Owner provisioning

No public owner registration is provided. A verified Supabase Auth user is assigned the owner role only through the service-role-only `provision_initial_owner` RPC. Remove the initial owner user ID and service-role configuration after provisioning.

## Testing

```powershell
npm run test
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

End-to-end authentication and owner workflows require the same isolated Supabase development project credentials. Without credentials, public UI pages can start, but authenticated and owner flows cannot be claimed as tested.

## External configuration status

The repository does not contain credentials and does not attempt to connect to production. Supabase Auth, database migrations, RLS, and owner provisioning remain unverified until an isolated development project is configured and tested.
