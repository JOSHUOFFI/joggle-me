# Deployment Strategy

> This strategy predates account removal. Supabase Auth setup, account
> provisioning, owner controls, and Auth-backed preview tests no longer apply.
> Supabase Auth is managed by the Supabase platform and its service schema is
> retained. The application has no dependency on it. See the decommission
> report for the boundary and current configuration status. No deployment was
> performed as part of this work.

## 1. Environments

### Local

- Developer-run Next.js
- Local or isolated test Supabase project
- Mock providers and synthetic fixtures by default
- No production secrets

### Preview

- Vercel preview deployments for pull requests
- Ephemeral or dedicated test database
- Test guest workspace isolation and private Storage
- Mock or tightly limited provider adapters

### Staging

- Production-like Next.js build
- Dedicated staging Supabase project
- Limited provider quota
- Synthetic documents and users
- Restore and migration rehearsal

### Production

- Vercel production deployment
- Production Supabase project
- Separate provider credentials and budgets
- Monitoring and owner controls
- No test accounts or synthetic documents

## 2. Delivery

- GitHub actions or Vercel checks for lint, type-check, tests, migrations review, and scans.
- Protected `main` branch.
- Pull-request previews.
- Database migrations reviewed and approved before production.
- Next.js application and database migrations deployed only through separately controlled processes.
- Production deployment requires a release owner and rollback plan.

## 3. Configuration

- Versioned environment variable names.
- Secret managers for provider, service, and signing secrets.
- Separate credentials per environment.
- Public variables are only publishable configuration.
- Feature flags for AI, uploads, generation, gamification, social, and paid features.

## 4. Database operations

- Supabase migrations stored as reviewed source only.
- No ad hoc production schema changes.
- Migrations are backwards-compatible where possible.
- Capture a restore point before destructive or complex migrations.
- Verify RLS policies and indexes after migration.
- No production migration is created or executed during Phase 0.

## 5. Observability

Track:

- HTTP availability, latency, and error rate
- Authentication failures
- Upload and extraction jobs
- Generation jobs
- Queue depth and dead letters
- Attempt submissions and deadline failures
- AI provider latency and usage
- AI cost budget
- Database connection health
- Storage failures
- Audit events
- Feature flag usage

Do not log private profile fields, source text, answer keys, or secret values.

## 6. Alerts

Initial alert categories:

- Availability and elevated 5xx
- Authentication anomalies
- RLS authorization failures
- Upload/queue backlog
- Processing failure increase
- AI error and cost thresholds
- Expired storage/signing failures
- Backup or restore failure
- Critical owner audit events

## 7. Rollback

- Vercel instant rollback to a known prior build.
- Database rollback only through tested forward-fix or compensating migration; do not assume every SQL migration is reversible.
- Provider kill switch disables generation.
- Upload kill switch disables new processing.
- Social and gamification feature flags support independent disablement.
- Record rollback owners and decision criteria.

## 8. Backup and recovery

- Verify Supabase backup support for the selected plan.
- Document RPO/RTO targets.
- Encrypt backups according to platform controls.
- Restrict backup access.
- Test restoration into staging.
- Account for object-storage lifecycle and derived data restoration.
- Add privacy and deletion constraints to backup retention if required.

## 9. Launch controls

Before initial production:

- Secrets rotation complete
- Owner accounts assigned under a break-glass process
- MFA/step-up available where supported
- RLS tested
- Backups and restore proven
- Upload and AI kill switches proven
- Monitoring and alert on-call documented
- Support and incident procedures documented
- Privacy, age, consent, and deletion review complete
- Load and security tests passed
- Rollback rehearsal completed

## 10. Cost controls

- Set Vercel, Supabase, Storage, and provider budgets.
- Alert before and at provider budget limits.
- Meter AI by operation/provider/model.
- Apply user and platform limits.
- Queue or reject long-generation work before cost exceeds owner policy.
- Review cost by feature and tenant aggregate.
