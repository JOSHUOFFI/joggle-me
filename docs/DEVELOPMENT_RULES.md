# Development Rules

## 1. Scope discipline

- Implement only the approved phase.
- Do not add provider, social, payment, or gamification functionality ahead of schedule.
- Do not claim a feature exists unless code and tests demonstrate it.
- Stop and request approval if requirements conflict or need a major architectural decision.

## 2. Repository layout

The initial implementation should use Next.js App Router modules, for example:

```text
app/
components/
features/
  identity/
  materials/
  ai/
  examinations/
  results/
  gamification/
  owner/
lib/
server/
database/
tests/
docs/
```

Exact layout may evolve, but domain modules must not be circularly dependent.

## 3. Code conventions

- Strict TypeScript with no implicit `any`.
- Prefer explicit domain types and Zod schemas at boundaries.
- Avoid casts that conceal invalid runtime data.
- Server-only modules must be marked or isolated.
- Shared code must not import server secrets or database service roles.
- React components should be small and separated by responsibility.
- Use server components for server data unless client interaction is required.
- Use server actions or route handlers according to domain boundaries.
- No answer keys in client components or normal API DTOs.

## 4. Database rules

- SQL migrations are forward-only and reviewed.
- RLS must be enabled for user and privileged data.
- Server/service operations must set and verify tenant scope.
- Every migration must include rollback or compensating strategy.
- Seed data must be deterministic and environment-specific.
- Role and feature settings use protected server operations.

## 5. API rules

- Use versioned contracts and Zod or equivalent runtime validation.
- Return stable DTOs and standard errors.
- Use idempotency for uploads, jobs, and submissions.
- Validate authorization in domain/application services in addition to RLS.
- Never log bodies containing secrets or private learning content by default.

## 6. Git and review

- GitHub branch protection on the main branch.
- Pull requests require at least one relevant review.
- CI must pass before merge.
- Small, focused commits and pull requests.
- Conventional commit messages are recommended.
- Generated lock files and dependency manifests must be reviewed.
- No secrets or personal data in commits.

## 7. Quality gates

Before merge:

- Unit and integration tests
- Relevant Playwright tests
- Type-check
- Lint/format
- Dependency and secret scan
- Migration review when applicable
- RLS tests for user-owned changes
- Owner authorization tests for privileged changes

Before production:

- Full regression
- Accessibility smoke
- Security scan
- Environment parity check
- Release/rollback plan

## 8. Dependency policy

- Use maintained dependencies with licenses compatible with the product.
- Pin lockfiles.
- Review high-impact dependency changes.
- Use Renovate or Dependabot only with CI enforcement.
- Remove unused dependencies and duplicate UI primitives.

## 9. Observability

- Structured logs with correlation IDs.
- Redact secrets and private content.
- Track web latency, job status, provider usage, and error rates.
- Store audit events separately from debug logs.
- Alert on security, availability, cost, and queue failures.

## 10. AI rules

- Provider calls are server-only.
- Domain code cannot depend on provider SDK types.
- Prompt and model versions are explicit.
- Raw AI output is treated as untrusted.
- Generated questions require validation before publication.
- AI usage and cost are accounted per operation.
