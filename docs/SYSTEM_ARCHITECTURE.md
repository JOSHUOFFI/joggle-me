# System architecture

JOGGLE ME is a Next.js learning application with anonymous, browser-held guest
workspace capabilities. It has no application accounts, login, registration,
role management, or owner portal.

## Request flow

1. A first visit to `/workspace/start` creates a 256-bit random capability.
2. The browser stores it in an HttpOnly, SameSite cookie; only its SHA-256 hash
   is stored in `public.guest_workspaces`.
3. Server-only code validates the cookie, resolves the workspace through the
   service-role RPC, and scopes reads and writes to that workspace UUID.
4. PostgreSQL ownership triggers require a live guest workspace and enforce
   upload, quiz, and examination usage limits.

The service-role key is confined to server modules. The browser never receives
the database credential or workspace token hash. Supabase provides the
PostgreSQL database and private learning-material Storage.

## Learning services

Learning materials, extracted document sections, Gemini analysis, generated
quizzes, timed examinations, automatic marking, results, and performance
analytics remain part of the product. Guest workspace ownership replaces the
former account UUID ownership. See
[`AUTH_DECOMMISSION_REPORT.md`](./AUTH_DECOMMISSION_REPORT.md) for the database
inventory, retained data, limitations, and incomplete hosted Auth shutdown.

## Known operational gaps

- Supabase-managed Auth service/configuration remains platform-owned; the
  application has no code dependency on it. See the decommission report.
- Guest workspace creation and settings isolation passed in two browser
  contexts; broader adversarial API testing remains outstanding.
- A Storage-aware cleanup endpoint and daily Vercel cron schedule are prepared,
  but the schedule needs `CRON_SECRET` and a deployment before it runs.
