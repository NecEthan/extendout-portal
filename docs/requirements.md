# Requirements

**Project:** KnowledgeGuard
**Source of truth:** `mvp.md`, `technical-design.md`

This describes what's actually built. The project is complete as delivered — there is no separate "production requirements" phase; the content that used to live here (enterprise connectors, event-driven sync, SSO, reranking, a Knowledge Health dashboard, an audit log, an evaluation framework) was never built and isn't planned.

---

## Authentication

1. Users can register with an email address and password (minimum 8 characters, one uppercase letter, one digit).
2. Passwords are stored as bcrypt hashes.
3. Users can log in and receive a server-side session.
4. The session ID is sent to the browser as an `HttpOnly`, `Secure`, `SameSite=Strict` cookie.
5. Sessions expire 24 hours after login (fixed expiry, not a sliding/inactivity window).
6. Sessions can be invalidated server-side at any time.
7. Users can log out, invalidating their session immediately.
8. Users can retrieve their own profile (`GET /auth/user`).
9. Repeated failed logins for an email lock that email out for 15 minutes (Redis counter), independent of per-IP rate limiting.

---

## Authorisation

10. Two roles exist: `admin` and `user`.
11. Admins have full access to all documents (STANDARD and SENSITIVE).
12. Users can access STANDARD documents only. SENSITIVE documents are inaccessible to users regardless of who uploaded them.
13. Documents have a `sensitivity` field: `STANDARD` or `SENSITIVE`. Sensitivity is set at upload time.
14. Only admins can upload SENSITIVE documents. A non-admin attempting to upload a SENSITIVE document receives `403 Forbidden`.
15. Authorisation checks are performed on every protected request at the backend. Ownership has no effect on access.

---

## Document Management

16. Users can upload documents in the following formats: PDF, DOCX, TXT, Markdown. There is no connector for Google Docs or any other external source — file upload is the only ingestion path.
17. Users can view a list of their accessible documents.
18. Users can view document metadata (title, source type, sensitivity, created date).
19. Users can upload a new version of an existing document.
20. Users can delete a document.
21. Users can view the full version history of a document and activate a previous version.

---

## Document Versioning

22. Every document update creates a new immutable version.
23. Only one version per document can have status `ACTIVE` at any time. This is enforced at the database level with a partial unique index.
24. Version statuses are: `PROCESSING`, `ACTIVE`, `SUPERSEDED`, `DELETED`, `REVIEW_REQUIRED`, `FAILED`.
25. When a new version becomes active, the previous active version transitions to `SUPERSEDED`.
26. The version transition (supersede old, activate new) is performed atomically in a single database transaction.
27. If a new version fails processing, the previous active version remains active.
28. A SHA-256 hash of the file is stored per version — blocks re-uploading an identical file and detects concurrent duplicate version uploads.

---

## Document Processing

29. Document processing runs asynchronously via an ARQ worker. The API does not block on processing.
30. On upload, the API validates the file, stores metadata in the database with status `PROCESSING`, stores the raw file in MinIO, and enqueues a processing job in Redis — all in one DB transaction, with the Redis enqueue as a best-effort step afterward.
31. If Redis is unavailable at enqueue time, the job stays `QUEUED` in the database and a poller (runs every 30s inside the backend process) retries it.
32. A reaper (same 30s loop) resets jobs stuck in `PROCESSING` for 10+ minutes back to `QUEUED`, recovering from worker crashes.
33. Processing steps: OCR (if scanned), text extraction, chunking, embedding generation (OpenAI `text-embedding-3-small`), insert into `document_chunks` (pgvector column), full-text search index update.
34. Failed jobs retry with backoff up to a configured max attempt count; non-retryable errors (bad input, auth/validation failures) fail immediately without retry.
35. After retries are exhausted, the version is marked `FAILED` and its MinIO object is deleted.
36. Processing is idempotent — a deterministic job id (`process_document:{version_id}`) means the poller re-enqueuing a job already in flight does not create duplicate work.
37. The frontend displays the current processing status of each document version.

---

## AI Query

38. Users can submit natural language questions via `POST /query`.
39. Every query goes through this pipeline in order: session authentication → permission filtering (role + sensitivity) → version filtering (`ACTIVE` only) → hybrid retrieval (pgvector cosine search + PostgreSQL `tsvector` full-text search) → Reciprocal Rank Fusion → context assembly → LLM generation (`gpt-4o-mini`) → answer and citations.
40. Permission filtering happens before any document content enters the retrieval pipeline. SENSITIVE documents are never loaded as context for non-admins.
41. Queries only ever search `ACTIVE` (current) versions. Previous versions stay available in version history but are never searched.
42. Every answer includes citations: document title, version number, version status, and last updated date.
43. The LLM's structured output is validated against a Pydantic schema before being returned to the client.
44. If the LLM API is unavailable, the query returns `503 Service Unavailable`.

---

## Deletion

45. Deleting a document hard-deletes its chunks, processing jobs, versions, and the document row itself, in FK-dependency order, in one transaction.
46. The raw file is not explicitly removed from MinIO on document deletion (only on processing failure after retries are exhausted).
47. A deleted document cannot appear in any query result, since its rows no longer exist.

---

## Permissions

48. Access is governed by user role and document sensitivity. There are no per-document permission grants.
49. Permission checks (role vs sensitivity) are performed before content is retrieved on every query and on every document list/read/write endpoint.
50. SENSITIVE documents are excluded from all retrieval and listing for non-admin users.

---

## Security

51. The backend validates all uploaded files independently of frontend validation, including file type and file size.
52. `/auth/login`, `/auth/register`, and `/query` are rate limited (per-IP, via slowapi + Redis). Document upload/version endpoints are not rate limited.
53. API keys and credentials are stored as environment variables and are never committed to source control or exposed to the frontend.
54. Database changes involving multiple related records are performed within transactions.

---

## Observability

55. The backend records structured logs (`structlog`) — JSON in production, pretty-printed in dev.
56. Every request is logged with `request_id`, method, path, status code, and `duration_ms`.
57. LLM calls are logged with model, token counts, duration, and estimated cost.
58. Worker jobs log start/complete/failure with duration, chunk count, and attempt number. The poller logs queue depth.
59. There is no metrics dashboard (Prometheus/Grafana/etc.) — logs only.

---

## Infrastructure

60. All services run via Docker Compose: Next.js frontend, FastAPI backend (2 uvicorn workers), a separate ARQ worker container, PostgreSQL (with pgvector), MinIO, Redis. Single instance of each — no load balancer, no CDN, no replica, no auto-scaling.
61. A single `docker compose up -d` command brings up the full stack.

---

## Testing

62. Backend: pytest unit tests (services) and integration tests (routers, processing pipeline) against a real Postgres instance.
63. Frontend: Jest unit tests for the API client layer.
64. End-to-end tests (Playwright) cover auth, document upload/versions, and search flows against the full running stack.
65. There is no evaluation framework and no automated accuracy/stale-retrieval tracking — that was planned but never built.

---

## API

66. The API exposes:

```
POST   /auth/register
POST   /auth/login
POST   /auth/logout
GET    /auth/user

POST   /documents
GET    /documents
GET    /documents/:id
PATCH  /documents/:id
DELETE /documents/:id

POST   /documents/:id/versions
GET    /documents/:id/versions
GET    /documents/:id/versions/:version_id
PATCH  /documents/:id/versions/:version_id/activate

POST   /query

GET    /health
```

There is no `/audit` endpoint — audit logging was built, then removed from the codebase, and is not exposed anywhere.
