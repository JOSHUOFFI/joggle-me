# AI Quiz Engine

## 1. Architecture

The AI quiz engine is a server-side pipeline with provider-independent interfaces:

- Document extraction port
- Retrieval/context port
- Structured generation port
- Validation port
- Answer marking port
- Usage metering port
- Provider/adapter registry

Gemini is the initial adapter. Provider-specific types must remain below the provider boundary. Domain code must receive canonical documents, contexts, questions, validation outcomes, and usage records.

## 2. Document processing

### Upload and validation

- Accept only allowlisted formats.
- Verify size, MIME, file signature, page/word limits, encryption, and archive contents.
- Quarantine and malware scan.
- Store original privately.

### Extraction

- Produce text, section/title hierarchy, page or slide location, reading order, language, and extraction confidence.
- Use format-specific parsers; DOCX and PPTX must preserve meaningful structure where possible.
- Mark OCR text when OCR is introduced later.
- Store source lineage from every chunk back to document and location.
- Record parser and parser-version.
- Do not expose raw provider prompts or internal extraction failures to normal users.

### Chunking

- Chunk by semantic sections, not arbitrary character cuts where possible.
- Preserve overlap only for retrieval.
- Attach document ID, document version, section ID, location, topic, language, and hash.
- Reject chunks from another tenant or document.

## 3. Grounded generation

Each generation job receives:

- Document version and selected document scope
- Selected topics and difficulty distribution
- Question count and duration
- Supported question types
- Prompt template version
- Provider/model policy
- User entitlement and limits

The model prompt must require:

- Questions derived only from supplied context
- A source reference for every question
- Exact answer-key format
- Explanation grounded in the source
- No hidden answer leakage
- No request to reveal system content or bypass retrieval

Generation uses structured JSON output and schema-constrained provider features when available. Canonical output is validated again in application code.

## 4. Question validation

Every question must pass:

- JSON/schema validation
- Text length and control-character checks
- Supported question-type check
- Option count and uniqueness
- Exactly one correct answer for single-choice questions
- Valid answer index/key
- Source section exists and belongs to the selected document
- Explanation existence and source grounding
- Difficulty and topic allowlist
- Duplicate and near-duplicate detection
- Unsupported claim or source mismatch checks

Generation is retried when low-risk structural validation fails. Invalid or unsupported questions are rejected, never silently fixed by guessing.

## 5. Answer verification

- For multiple choice and true/false, compare canonical keys.
- For short answer, use a versioned marking policy, accepted variants, and confidence limits.
- Never grade with a second unconstrained model call by default.
- Store answer key server-side and return it only after attempt finalisation.
- Store a separate verification result for low-confidence AI-assisted judging.
- Test the answer-key position against source evidence and expected option semantics.

## 6. Provider abstraction

Canonical provider interface methods:

- `generateStructured(context, request, policy)`
- `healthCheck()`
- `estimateUsage(request)`
- `cancel?`

Adapter responses must normalize:

- Request/correlation IDs
- Raw usage counts
- Finish reason
- Latency
- Provider/model
- Structured output or explicit parse failure

Domain code must not reference Gemini SDK types.

## 7. Retries and failures

- Retry transient provider errors with bounded exponential backoff.
- Idempotency key includes document version, prompt version, model, and configuration hash.
- Retry no more than 3 times for initial service.
- Dead-letter after retry exhaustion.
- Preserve partial/non-published generation; never expose partial quizzes as valid.
- Distinguish quota, provider outage, context limit, validation failure, cancellation, and unknown failure.
- User-facing errors must hide provider and internal details.

## 8. Token and cost controls

- Estimate context and generation cost before dispatch.
- Apply owner-configured user and platform limits.
- Track input/output tokens and estimated cost per job.
- Alert at 50%, 80%, and 100% of configured budgets.
- Cache retrieval context and generation plans where valid.
- Store prompts, model, prompt version, provider, and usage event without raw sensitive text in analytics.
- Deny or queue generation when the user's or platform budget is exceeded.

## 9. Prompt and model governance

- Templates are versioned and reviewed.
- Provider/model upgrades require regression tests.
- Prompt changes trigger new quiz-generation test runs.
- Enforce a model allowlist.
- Disallow provider training on JOGGLE ME data unless explicitly approved.
- Record model and provider safety policy changes.

## 10. AI testing

- Fixture documents with known answer facts
- Question count and type tests
- Hallucination and source-mismatch tests
- Prompt-injection tests
- Answer-key and explanation consistency tests
- Formatting and malformed provider response tests
- Tenant-crossing/context leak tests
- Provider failure/retry tests
- Cost and token accounting tests
