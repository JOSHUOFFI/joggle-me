# API Contracts

## 1. Contract principles

- Use versioned HTTP APIs under `/api/v1/*`.
- JSON bodies use strict schemas and unknown-field rejection where practical.
- Authentication is required except explicitly public health and marketing endpoints.
- All mutations require authorization and CSRF protection where cookie sessions are used.
- Responses use stable DTOs rather than raw database rows.
- Answer keys are never included in learner-facing responses.
- Background job operations use idempotency keys and immutable job snapshots.

## 2. Standard headers

- `Authorization: Bearer` for supported token flows
- `Idempotency-Key` for uploads, generation, and submissions
- `X-Correlation-ID` echoed when supplied
- `If-Match` or optimistic version for mutable attempts where implemented

## 3. Standard response shape

Success:

```json
{
  "data": {},
  "meta": {
    "correlationId": "..."
  }
}
```

Error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid.",
    "details": [],
    "correlationId": "..."
  }
}
```

No internal stack, database error, provider response, or secret may be returned.

## 4. Initial endpoint groups

### Profiles

- `GET /api/v1/me`
- `PATCH /api/v1/me`
- `POST /api/v1/me/export`
- `POST /api/v1/me/delete-request`
- `GET /api/v1/me/history`

### Documents

- `POST /api/v1/documents`
- `GET /api/v1/documents`
- `GET /api/v1/documents/{documentId}`
- `DELETE /api/v1/documents/{documentId}`
- `POST /api/v1/documents/{documentId}/reprocess`
- `GET /api/v1/documents/{documentId}/status`

### Processing and AI jobs

- `POST /api/v1/jobs/document-processing`
- `POST /api/v1/jobs/quiz-generation`
- `GET /api/v1/jobs/{jobId}`
- `POST /api/v1/jobs/{jobId}/retry`
- `POST /api/v1/jobs/{jobId}/cancel`

### Quizzes

- `POST /api/v1/quizzes`
- `GET /api/v1/quizzes`
- `GET /api/v1/quizzes/{quizId}`
- `DELETE /api/v1/quizzes/{quizId}`

### Attempts

- `POST /api/v1/quizzes/{quizId}/attempts`
- `GET /api/v1/attempts/{attemptId}`
- `PATCH /api/v1/attempts/{attemptId}/answers`
- `POST /api/v1/attempts/{attemptId}/submit`
- `GET /api/v1/attempts/{attemptId}/result`

### Results

- `GET /api/v1/results`
- `GET /api/v1/results/{attemptId}`
- `GET /api/v1/performance/topics`
- `GET /api/v1/performance/recommendations`

### Owner

- `GET /api/v1/owner/overview`
- `GET /api/v1/owner/users`
- `GET /api/v1/owner/users/{userId}`
- `PATCH /api/v1/owner/users/{userId}/status`
- `PUT /api/v1/owner/users/{userId}/roles`
- `GET /api/v1/owner/usage`
- `GET /api/v1/owner/audit-events`
- `GET /api/v1/owner/features`
- `PATCH /api/v1/owner/features/{key}`

No public path may infer admin status from a user-supplied query or body field.

## 5. Pagination

Use cursor pagination:

```json
{
  "data": [],
  "meta": {
    "nextCursor": "opaque-string-or-null",
    "pageSize": 25
  }
}
```

Maximum page size is 100 unless stricter owner policy exists.

## 6. Status codes

- `200` successful read or mutation
- `201` resource created
- `202` background work accepted
- `400` malformed request
- `401` unauthenticated
- `403` forbidden
- `404` hidden or missing resource
- `409` version, lifecycle, or idempotency conflict
- `422` domain validation failure
- `429` rate limited
- `503` temporary dependency outage

## 7. Upload contract

1. `POST /api/v1/documents` validates metadata and returns a short-lived signed upload.
2. Client uploads directly to private storage only if storage policy permits.
3. Client confirms upload.
4. Server creates and queues the processing job.

Never accept a storage object ID without verifying the user and content ownership.

## 8. Attempt contract

- The attempt create response includes server deadline and quiz questions, but no answer keys.
- Autosave accepts only defined question IDs and answer revisions.
- Submit is idempotent; repeated submission returns the existing final result or conflict.
- Deadline enforcement occurs on the server, not the browser.
- An expired attempt can be finalised only by a server-authoritative deadline check.
