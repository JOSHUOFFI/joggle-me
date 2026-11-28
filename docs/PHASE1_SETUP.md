# Application setup

## Local application

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_APP_URL`, and the
server-only `SUPABASE_SERVICE_ROLE_KEY`. Gemini integration uses
`GEMINI_API_KEY`; do not place any secret in a `NEXT_PUBLIC_*` variable.
Supabase is used for PostgreSQL and private Storage. The application has no
user accounts or sign-in provider.

The first visit creates an anonymous workspace. The browser receives a random
HttpOnly capability cookie while the database stores only its SHA-256 hash.
The cookie cannot be recovered if cleared, so users should understand that
workspace data is associated with that browser capability.

## Database

See [the Supabase setup guide](../supabase/README.md) and
[the authentication decommission report](./AUTH_DECOMMISSION_REPORT.md).
Check the configured project reference before using the application or running
database commands. Never connect to production for local development.

## Verification

```powershell
npm run test
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests that create a workspace require valid development Supabase
credentials. They must never run against production.
