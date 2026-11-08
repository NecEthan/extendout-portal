# Technical Design

**Product:** ExtendOut Portal (repository: `knowledgeguard`)
**See also:** [overview.md](overview.md), [architecture.md](architecture.md), [requirements.md](requirements.md)

---

## 1. Overview

The ExtendOut Portal is the project workspace for ExtendOut Design | Build. Office staff, the site team and homeowners share each job's documents, and anyone on a project can ask questions answered from that project's current documents, with a citation to the source file and version.

The design guarantees three things: people only see the projects they belong to, answers only come from the current version of each document, and every answer is traceable to its source.

---

## 2. Frontend design

### Route protection

`src/proxy.ts` redirects to `/login` when the `kg_ui_auth` hint cookie is missing, and away from `/login` when it's present. It also lets public image files (logo, favicon) through without a session. This is a convenience only: anyone can call the API directly, so the backend performs the real authentication and authorisation on every request.

Admin-only UI (the Team page and sidebar link, the project Team tab, **New project** and **Edit**) is hidden for builders and clients. The backend rejects those actions with `403` regardless.

### Authentication

The session lives on the server. The browser holds only the session id in an `HttpOnly` cookie, so JavaScript (and therefore an XSS bug) can't read it. Requests include it automatically via `credentials: "include"`.

In production the cookie is `Secure` and `SameSite=None` (the frontend and API are on different sites, so the cookie must be sent cross-site); in development it's `SameSite=Lax`.

### File uploads

The upload form limits file type and size for quick feedback. The backend re-validates everything, since the form can be bypassed.

### Processing state

Processing is asynchronous, so the UI reads each version's status from the backend and polls every 3 seconds while anything is still processing, stopping once all versions settle.

### Server state and errors

TanStack Query owns all server state (`src/hooks/`). Mutations invalidate the queries they affect, so lists refresh after a change without manual refetching.

A `401` anywhere redirects to `/login` (handled once in `QueryProvider`). Other errors (`403/404/409/413/415/422/429/503`, network) are shown inline next to the action that failed, via `ErrorAlert`. Queries aren't retried on `401`.

### Loading and duplicate actions

Buttons show a pending state and are disabled while a request is in flight. The backend still protects against duplicates (content hash, deterministic job ids), since frontend controls can be bypassed.

---

## 3. Backend design

### Authentication

Every protected request resolves the session cookie against the `sessions` table (`get_current_user`). Server-side sessions mean a role change or logout takes effect on the next request.

### Authorisation

Authentication says who the user is; authorisation says what they can touch. Every document query applies `document_access_filters(user)`, project routes call `ensure_project_access`, and admin-only routes depend on `require_admin`. See [§5](#5-roles-and-access).

### API validation

Pydantic schemas validate every request body. Text fields on projects are trimmed before validation, so a name of only spaces is rejected.

### File uploads

The backend checks the file is non-empty (`422`), within 50 MB (`413`) and a supported type by content, not just extension (`415`). Files get a unique storage key and are stored in MinIO, separate from the database.

### Orphaned upload cleanup

Uploading to MinIO and committing the database transaction are two separate steps. If the process dies between them, MinIO holds a file with no database record.

Every uploaded object is therefore tagged `kg-orphan=true` straight away, and a MinIO lifecycle rule (set at startup) deletes tagged objects after 24 hours. Once the transaction commits, the tag is removed. Both calls are best-effort: failures are logged, not fatal, because the lifecycle rule is a safety net.

### Processing uploads

The worker first marks the job `PROCESSING` and commits, so the poller won't pick it up again mid-run. It then downloads, extracts, chunks and embeds outside any transaction, and finally persists everything in one transaction: insert chunks, update the full-text index, supersede the old `ACTIVE` version, activate the new one, mark the job `COMPLETE`. Any error rolls the whole step back.

### Reaper

If the worker dies hard (power loss, `SIGKILL`), no `except` block runs and the job would sit in `PROCESSING` forever. The reaper runs every 30 seconds and resets any `PROCESSING` job untouched for 10+ minutes back to `QUEUED`. Jobs past the retry limit are marked `FAILED` and their file is deleted.

### Poller

The job row is committed to Postgres before enqueueing to Redis. If the process crashes or Redis is down in between, the job stays `QUEUED`. The poller checks every 30 seconds and enqueues any `QUEUED` jobs, using the same deterministic job id so arq ignores duplicates. arq's own retries handle failures during processing; the poller covers jobs that never reached the queue.

### Document integrity

Each upload's SHA-256 hash is stored. It blocks re-uploading an identical file and detects concurrent duplicate uploads.

### Asynchronous processing and reliability

Processing runs in a separate worker so slow OCR and embedding work never holds an HTTP request open. Transient failures retry with backoff (60 s for OpenAI rate limits) up to `MAX_TRIES`; permanent failures (bad input, OpenAI auth/validation errors) fail immediately. Worker concurrency is capped at 5 jobs to stay within OpenAI rate limits.

### Database transactions

Changes spanning several rows (upload, version activation, deletion) use one transaction. Slow external calls (OpenAI, MinIO) happen outside transactions.

### AI responses

The LLM is treated as unreliable: its JSON output is validated against a Pydantic schema, and OpenAI failures return `503`.

### Secrets

API keys and credentials come from environment variables, never the frontend or source control.

### Rate limiting

Per-IP limits via slowapi + Redis: `/auth/login` at 5/minute (credential attacks), `/query` at 20/minute (each query costs two OpenAI calls). Failed logins also lock the email for 15 minutes after 5 attempts.

### Observability

Structured logs (`structlog`) to stdout: request logs with `request_id`, status and duration; LLM calls with tokens, duration and cost; worker jobs with duration, chunk count and attempt; poller queue depth. Locally they're visible with `docker compose logs`. There is no metrics dashboard or audit log.

---

## 4. Search pipeline

Runs on every `POST /query`, always in this order.

### Step 1 — Authentication

A valid session cookie is required, otherwise `401`.

### Step 2 — Project access

If `project_id` is given (the project Search tab always sends it), the user must have access: unknown project `404`, not a member `403`.

### Step 3 — Permitted documents

`build_permitted_doc_ids(user, project_id)` builds a subquery of the documents the user may search: the given project's documents, further limited to the user's member projects for builders and clients. Everything below is restricted to this set inside the SQL query, so nothing else can reach the LLM.

### Step 4 — Current versions only

Only `ACTIVE` versions are searched. Superseded, failed and processing versions are excluded.

### Step 5 — Hybrid retrieval

- **Vector search:** the question is embedded with the same model used at index time (`text-embedding-3-small`), and pgvector finds the nearest chunks by cosine distance.
- **Full-text search:** Postgres `tsvector`/`plainto_tsquery` keyword matching over the same set.

### Step 6 — Ranking

Reciprocal Rank Fusion merges the two ranked lists; the top chunks go forward.

### Step 7 — Context and generation

The chunks are formatted with their document title, version number and status, and sent to `gpt-4o-mini` with instructions to answer only from that context, cite its sources, and say so if the answer isn't there.

### Step 8 — Response

The validated answer and citations (title, version, status, last updated) are returned.

---

## 5. Roles and access

| Role | Projects | Documents and search | Admin actions |
|---|---|---|---|
| `admin` | All | All | Create/edit projects, Team page, roles, project members |
| `builder` | Member projects | Member projects | — |
| `client` | Member projects | Member projects | — |

- There's no public sign-up: admins create accounts (and set the role) on the Team page.
- Builders and clients have identical document permissions.
- Documents with no project are admin-only.
- Admins can't change their own role, so the last admin can't lock themselves out.

---

## 6. Version transition

1. A new `DocumentVersion` is created as `PROCESSING`.
2. The worker processes it.
3. On success, in one transaction: the current `ACTIVE` version becomes `SUPERSEDED` and the new one becomes `ACTIVE`. The old version's chunks stay in the database but are filtered out of search.
4. On failure the new version becomes `FAILED` and the previous version stays `ACTIVE`.

There is never a moment with zero active versions (if one existed before). An older version can be re-activated from version history, which swaps the statuses the same way.

---

## 7. Deletion

Deleting a document is a hard delete, in one transaction and in foreign-key order: chunks → processing jobs → versions → document. Afterwards it can't appear anywhere and requests for it return `404`. The original file stays in MinIO.

---

## 8. Error handling

| Scenario | Behaviour |
|---|---|
| Missing or expired session | `401`, frontend redirects to `/login` |
| Not a member of the project / not an admin | `403` |
| Unknown project or document (or document outside your projects) | `404` |
| Duplicate file | `409` |
| File too large | `413` |
| Unsupported file type | `415` |
| Invalid input | `422` |
| Rate limit hit | `429` |
| OpenAI unavailable | `503` |
| Processing failure | Version `FAILED`, shown in the UI |
| Version transition failure | Rolled back, previous version stays `ACTIVE` |

---

## 9. Testing

- **Backend unit tests (pytest):** auth helpers, chunking, document validation, text extraction, RRF, logging.
- **Backend integration tests (pytest, real Postgres):** routers (auth, projects, team, documents, versions, query) and the processing pipeline, including access isolation between projects and exclusion of superseded versions from search.
- **Frontend (Jest):** API client and helpers.
- **End-to-end (Playwright):** auth, document upload and versions, and search against the running stack.

---

## 10. Key decisions

### Why keep superseded chunks?

An older version can be re-activated, and keeping its chunks means it's searchable again instantly, without re-processing. Search excludes them with a status filter rather than deleting them.

### Why MinIO for files?

Postgres isn't built for large binary files. Object storage keeps the database small and file reads off the database connection pool.

### Why pgvector rather than a vector database?

A separate vector database is another system to run and keep in sync with the relational data. At the portal's document volumes, pgvector in the same Postgres is enough, and permission and version filters run in the same SQL query as the similarity search.

### Why integer project ids?

A plain auto-increment identity column is the standard approach and needs no id-generation code. Ids are guessable, which is fine because every project endpoint checks membership.

### Why role + membership rather than per-document permissions?

Construction access maps naturally to projects: everyone on a job needs that job's documents, and no one else does. Per-document grants would add admin work without matching how the business operates.
