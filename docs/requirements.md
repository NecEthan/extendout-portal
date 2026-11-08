# Requirements

**Product:** ExtendOut Portal (repository: `knowledgeguard`)
**See also:** [overview.md](overview.md), [architecture.md](architecture.md), [technical-design.md](technical-design.md)

What the portal does today. Screens that still show sample data are listed in [overview.md](overview.md#whats-real-vs-sample-data) and are not covered here.

---

## Authentication

1. There is no public sign-up. Admins create accounts on the Team page (`POST /team`) with email, starting password, role (`admin`, `builder` or `client`) and an optional name.
2. Passwords need at least 8 characters, one uppercase letter and one digit, and are stored as bcrypt hashes.
3. Logging in creates a server-side session. The session id is sent as an `HttpOnly` cookie (`Secure` + `SameSite=None` in production, `SameSite=Lax` in development).
4. Sessions expire 24 hours after login (fixed, not sliding) and can be invalidated server-side at any time.
5. Logging out invalidates the session immediately.
6. Users can fetch their own profile (`GET /auth/user`).
7. After 5 failed logins for an email, that email is locked for 15 minutes, independent of per-IP rate limiting.

---

## Roles and access

8. Three roles: `admin`, `builder`, `client`.
9. Access is decided by role + project membership. Document ownership has no effect.
10. Admins can see and act on every project and document.
11. Builders and clients have identical permissions: they can only see projects they're a member of, and only the documents in those projects.
12. Requesting an unknown project returns `404`; a project the user isn't a member of returns `403`. A document outside the user's projects returns `404`.
13. Documents with no project (legacy) are visible to admins only.
14. All checks happen in the backend on every request. The frontend hides admin-only UI but is not relied on for security.

---

## Projects

15. A project has an integer id (auto-increment), name, client and address.
16. Users see a list of the projects they can access (admins: all).
17. Only admins can create projects (`POST /projects`). The name is required; client and address are optional. Text is trimmed.
18. Only admins can edit projects (`PATCH /projects/{id}`). Only the fields sent are changed; fields can't be set to `null` and the name can't be blank.

---

## Team and project membership (admin only)

19. Admins can list every user with their role and project memberships (`GET /team`) and create accounts (`POST /team`). A duplicate email returns `409`.
20. Admins can change a user's role (`PATCH /team/{user_id}`), except their own.
21. Admins can list, add and remove the members of a project (`/projects/{id}/members`).
22. Builders and clients cannot see the Team page or any project's member list (`403`).

---

## Documents

23. Users can upload PDF, DOCX, TXT or Markdown files (max 50 MB) to a project they can access. The backend checks file type and size independently of the frontend.
24. Users can list a project's documents (paginated), view a document, rename it, and delete it.
25. Re-uploading an identical file (same SHA-256 hash) is rejected as a duplicate.

---

## Versions

26. Uploading a new version of a document creates a new immutable version; history is kept.
27. Exactly one version per document can be `ACTIVE`, enforced by a partial unique index.
28. Statuses: `PROCESSING`, `ACTIVE`, `SUPERSEDED`, `DELETED`, `REVIEW_REQUIRED`, `FAILED`.
29. When a new version finishes processing, the previous `ACTIVE` version becomes `SUPERSEDED` and the new one becomes `ACTIVE` in a single transaction.
30. If a new version fails processing, the previous active version stays active.
31. Users can view a document's version history and re-activate an older version.
32. Concurrent version uploads are handled by a unique (document, version number) constraint with retry.

---

## Processing

33. Processing runs asynchronously in an ARQ worker; the upload request returns `202` without waiting.
34. The upload writes the Document, Version (`PROCESSING`) and ProcessingJob (`QUEUED`) in one transaction, then enqueues to Redis best-effort.
35. A poller (every 30 s) re-enqueues `QUEUED` jobs, so a Redis outage loses no work. A deterministic job id prevents duplicate processing.
36. A reaper resets jobs stuck in `PROCESSING` for 10+ minutes (worker crash) back to `QUEUED`.
37. Pipeline: download from MinIO → extract text (OCR for scanned PDFs) → chunk → embed (OpenAI `text-embedding-3-small`) → store chunks + update the full-text index → activate.
38. Transient errors retry with backoff (OpenAI rate limits wait 60 s) up to `MAX_TRIES`; bad input and OpenAI auth/validation errors fail immediately.
39. When retries are exhausted the version is marked `FAILED` and its MinIO file is deleted.
40. The frontend shows each version's processing status and refreshes it while processing.

---

## AI search

41. Users ask natural-language questions with `POST /query`, scoped to a project they can access (`403` otherwise).
42. Search only uses **current (`ACTIVE`) versions**. Previous versions remain in version history but are never searched.
43. Pipeline: authentication → project access → permitted documents → active versions → hybrid retrieval (pgvector cosine + Postgres full-text) → Reciprocal Rank Fusion → context assembly → `gpt-4o-mini` → answer with citations.
44. Permission and version filtering happen in the database query, before any content reaches the LLM.
45. Every answer cites document title, version number, status and last-updated date.
46. The LLM's structured output is validated against a Pydantic schema.
47. If OpenAI is unavailable the query returns `503`.

---

## Deletion

48. Deleting a document hard-deletes its chunks, processing jobs, versions and the document itself in one transaction.
49. A deleted document can't appear in any list or search result.
50. The original file is not removed from MinIO on deletion (only when processing fails permanently).

---

## Security

51. Rate limits (slowapi + Redis): `/auth/login` 20/minute **per IP** (plus the per-email lock after 5 wrong passwords); `/query` 20/minute **per user**; uploads (new documents and new versions combined) 30/minute **per user**; every other route a 300/minute **per session** backstop. `/health` is never limited. Over the limit returns `429`.
52. API keys and credentials come from environment variables, never the frontend or source control.
53. Changes that touch several related rows happen in a single transaction.

---

## Observability

54. Structured logs (`structlog`): JSON in production, readable in development.
55. Every request logs `request_id`, method, path, status and `duration_ms`.
56. LLM calls log model, token counts, duration and estimated cost.
57. Worker jobs log start/complete/failure with duration, chunk count and attempt number; the poller logs queue depth.
58. There is no metrics dashboard — logs only.

---

## Infrastructure

59. Docker Compose runs the frontend, backend (2 uvicorn workers), ARQ worker, Postgres (pgvector), MinIO and Redis — one instance of each.
60. `docker compose up -d` starts the whole stack.

---

## Testing

61. Backend: pytest unit tests (services) and integration tests (routers, processing) against a real Postgres.
62. Frontend: Jest unit tests.
63. End-to-end: Playwright tests for auth, documents, versions and search against the running stack.

---

## API

```
POST   /auth/login
POST   /auth/logout
GET    /auth/user

GET    /projects
POST   /projects                                   admin
GET    /projects/{id}
PATCH  /projects/{id}                              admin
GET    /projects/{id}/members                      admin
POST   /projects/{id}/members                      admin
DELETE /projects/{id}/members/{user_id}            admin

GET    /team                                       admin
POST   /team                                       admin
PATCH  /team/{user_id}                             admin

POST   /documents
GET    /documents?project_id=…
GET    /documents/{id}
PATCH  /documents/{id}
DELETE /documents/{id}

POST   /documents/{id}/versions
GET    /documents/{id}/versions
GET    /documents/{id}/versions/{version_id}
PATCH  /documents/{id}/versions/{version_id}/activate

POST   /query

GET    /health
```
