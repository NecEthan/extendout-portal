# Engineering Decisions

## Per-Email Brute Force Protection

IP rate limiting alone doesn't stop an attacker with rotating proxies targeting a specific account. After 5 failed login attempts for an email address, that email is locked for 15 minutes via a Redis counter (`login_fail:{email}`). Successful login clears the counter. Window and attempt count are config-driven (`login_max_attempts`, `login_lockout_seconds`). This can be abused to lock someone out on purpose; see _Login uses two counters_ under Rate Limiting: How It Works.

## Password Strength

Minimum 8 characters enforced at the Pydantic schema level, plus at least one uppercase letter and one digit, when an admin creates an account (`POST /team`). Validation happens before the bcrypt hash is computed — no wasted CPU on weak passwords.

## Auth Rate Limiting

`POST /auth/login` is capped at 20 requests/minute per IP, across all emails, to stop one machine trying many accounts. Window resets after 60 seconds, no permanent lockout. Configured by `login_rate_limit`. It was 5/minute at first, the same as the per-email lock threshold; because the IP check runs first, the 6th wrong password was answered by the IP limit instead of the lock. Keeping it above `login_max_attempts` means a user guessing one account gets the lock.

## No Public Sign-Up

Accounts are only created by admins on the Team page (`POST /team`). Public registration (`/auth/register`) was removed: it let anyone choose their own role, including `admin`, which would have given a stranger access to every project. It also duplicated the admin create-user flow. Clients and trades are always invited by the office, so self sign-up isn't needed.

## Auth

A server-side session was chosen because it provides immediate server-side control over authentication and permissions. Each request validates the session against the database, so permission changes take effect on the user's next request without requiring additional session-invalidation logic. This does add an extra database lookup per authenticated request, but the lookup is lightweight and is not expected to noticeably slow down the application. If it becomes a bottleneck at scale, session lookups can be optimised or cached.

# Document Upload

## Allowed file types: PDF, Word and Excel

Uploads accept only PDF (`.pdf`), Word (`.docx`) and Excel (`.xlsx`), the formats the office and trades actually send: drawings and calcs as PDF, specs and letters as Word, quotes and cost sheets as Excel. Nobody on site produces them, and every extra format is more extraction code to maintain. The old binary `.doc` and `.xls` formats aren't supported; they need different libraries and are rarely used now.

## File type is detected from the bytes, not the name or browser

A file's name and the `Content-Type` the browser sends are both chosen by the client, so they can't be trusted: an `.exe` renamed to `.pdf` would pass a name check. `detect_content_type()` (`app/services/documents.py`) reads the file itself:

- PDF starts with `%PDF`.
- `.docx` and `.xlsx` are both zip archives (Office Open XML) and both start with `PK\x03\x04`, so the first bytes can't tell them apart. The archive is opened and its file list checked: `word/document.xml` means Word, `xl/workbook.xml` means Excel. Any other zip is rejected.

Anything else gets a `415` naming the allowed types. The frontend's `accept=".pdf,.docx,.xlsx"` only filters the file picker for convenience; the backend check is the real one.

## Text extraction uses libraries, not AI

Word and Excel files already contain their exact text, so a parser reads them perfectly, instantly and for free:

- **Word:** `python-docx` reads paragraphs. Tables inside Word documents are **not** extracted yet (a known gap).
- **Excel:** `openpyxl` reads every sheet. Each non-empty row becomes one line with cells joined by `|`, under a `Sheet: <name>` heading, so the LLM can read rows like `Steel beam | 450`. A library like pandas or markitdown was considered but would add a heavy dependency for roughly the same amount of code.
- **PDF:** PyMuPDF, with Tesseract OCR as a fallback for scanned pages.

An AI model would add cost and latency per file and could misread figures, which is unacceptable for prices and measurements. Where AI would help is files with no real text in them (scanned PDFs, photos of drawings or handwritten notes). Replacing the Tesseract fallback with a vision model is the likely next step there.

## Upload is a multipart form, not JSON

`POST /documents` takes `multipart/form-data` (`file`, `title`, `project_id`), read by FastAPI's `UploadFile` and `Form()`. JSON can't carry raw bytes: `JSON.stringify` turns a `File` into `{}`. Base64 inside JSON works but makes the file about 33% bigger and forces both sides to hold the whole thing in memory. A presigned-URL upload straight to MinIO was also considered. It keeps big files off the API server but needs three requests, cleanup for abandoned uploads, and moves the file-type check after the file is stored. At a 100 MB limit, multipart through the API is still simpler.

The URL is `/documents` (plural): `POST` to the collection creates an item in it, matching `/projects`, `/team` and `/projects/{id}/members`.

## Title comes from the file name

There's no title field in the upload form. The title is the file name without its extension (`Kitchen quote.pdf` → `Kitchen quote`, via `titleFromFilename` in `frontend/src/lib/format.ts`). The original file name isn't stored anywhere else (the MinIO key is a random UUID), so the title is the document's only human-readable name. It's shown in the document list and used in search citations (`[Source: <title> v<n>]`), and citations are matched back to documents by title and version number.

The title is **not** searchable yet: keyword search and embeddings only use the document's text, so naming a document in a question doesn't help find it. Adding the title to the `search_vector` with a higher weight is the planned fix.

## Size limit

Uploads are capped at 100 MB (`max_upload_size_mb`), raised from 50 MB because full drawing sets and scanned calc packs can exceed 50 MB. The backend reads at most limit + 1 bytes, so an oversized file is rejected with `413` without reading the whole thing into memory. The file is also checked for being empty (`422`).

## Save to the database before Redis (transactional outbox)

Document, DocumentVersion and ProcessingJob are all inserted in one DB transaction before touching Redis. If Redis is down, the records still exist with the job `QUEUED`, so no work is lost. This needs a poller that queries the DB every so often, but that query is cheap.

I chose a polling publisher because it provides the reliability I need while keeping the architecture simple. The poller checks the `ProcessingJob` table for queued jobs and publishes them to Redis, so a crash or Redis outage does not lose a committed job. CDC would give lower latency and avoid repeated polling, but it needs database-specific transaction-log infrastructure and is more complex to operate. Document processing takes far longer than a few seconds anyway, so the small polling delay is an acceptable trade-off for a simpler system.

If an error occurs after the job is enqueued but before its status is set to `DISPATCHED`, the poller will pick the still-`QUEUED` job up and enqueue it again. This is safe: jobs use a deterministic id (`process_document:{version_id}`), and ARQ's `enqueue_job` returns `None` instead of adding a second job with the same id.

## Orphaned files in MinIO

A file is uploaded to MinIO _before_ its database row is committed, because the two can't be done atomically. If the database insert fails with an error, the upload's `except` block deletes the file straight away. If the process is killed in between (crash, container restart), the file stays in MinIO with nothing pointing to it: an orphan.

**Decision: accept rare orphans; never delete files automatically.**

The first version tagged each new object as an orphan, removed the tag after the commit, and had a MinIO lifecycle rule delete anything still tagged after a day. It was removed because it failed in the wrong direction: if the tag removal was missed (a crash or MinIO hiccup right after a successful commit), the rule deleted a **real** photo or document a day later, leaving a broken record. Losing client data is far worse than wasting a little storage.

For this app's scale (around a dozen customers), orphans need a crash in a window of milliseconds during an upload, so they should be rare to non-existent, and each one only costs storage. The old lifecycle rule is removed from the bucket at startup (`remove_orphan_lifecycle_rule` in `app/services/storage.py`), since rules live in MinIO and would otherwise keep deleting tagged files.

If orphans ever matter, the safe fix is a clean-up job that lists objects older than a day and deletes only those **no database row references** (`document_versions.storage_key`, `project_photos.storage_key`). That fails safe: when unsure, it keeps the file.

## Duplicate uploads are rejected per project

Each upload's SHA-256 hash (`compute_hash`) is stored on its version. The same file can't be uploaded twice to one project, as a new document or as a new version. It can be uploaded to different projects, since each job has its own copy of the drawings. Re-uploading an older version's file as a new version is also a `409`; "Set as active" restores an old version instead.

Two layers enforce this:

1. **Code check** (`assert_no_duplicate`): looks for a version with the same hash in the project and returns `409` *before* the file is sent to MinIO, so the normal case is cheap and gives a clear message.
2. **Partial unique index** `uq_document_versions_project_content_hash` on `(project_id, content_hash) WHERE status <> 'FAILED'`. The code check alone has a race: the window between check and commit includes the MinIO upload (seconds for a large file), and a check can't see another request's uncommitted rows. So two people uploading the same drawing at once would both pass. The index is enforced by Postgres at insert time, so the second commit fails; the endpoint rolls back, deletes its MinIO object and returns the same `409`.

Why a hash and not a constraint on the file itself: the bytes live in MinIO, not Postgres, and a B-tree index entry can't exceed about 2.7 KB anyway. A 64-character hash indexes cheaply.

`project_id` is copied onto `document_versions` because the hash is on the version and the project is on the document, and an index can't span two tables. A document never changes project, so the copy can't go stale.

`FAILED` versions are excluded from both layers, so if processing fails the user can upload the same file again. Before this, a failed upload blocked its own retry with "already exists".

Legacy documents with no project (`project_id IS NULL`) aren't covered by the index, since Postgres treats NULLs as distinct; the code check still applies to them.

The hash is for spotting duplicates only. It doesn't hide or protect anything: the original file is still stored in MinIO and its text in Postgres, and a hash is one-way so it can't replace the file.

## Concurrent new versions

`UniqueConstraint("document_id", "version_number", name="uq_document_version")` stops two versions getting the same number. The next number is `max(version_number) + 1`, so if two users upload a new version of the same document at once, the second commit violates the constraint, rolls back, deletes its MinIO object and fails. The user can simply upload again. Retrying automatically with the next number isn't implemented; it's only worth adding if simultaneous version uploads turn out to be common.

## Who can upload

Access is by project membership: `ensure_project_access` returns `404` for an unknown project and `403` if a builder or client isn't a member. Admins can upload to any project (the existence check still runs first, so an admin gets `404` for a project that doesn't exist). See _Projects and Access_.

## Uploads are rate limited

New documents and new versions share one 30/minute per-user limit, because each upload can trigger OCR and hundreds of embedding calls. See _LLM Rate Limiting_.

## Storage is not encrypted at rest

Documents are protected by access control in the app, not by encryption. Files sit unencrypted in MinIO and their text in Postgres, so anyone with direct access to the storage or its backups can read them. For production, enable MinIO server-side encryption and encrypted Postgres volumes/backups, and serve everything over HTTPS. Encryption doesn't stop an app user who _has_ access from reading a document; that's what access control is for.

# Site Photos

## Location metadata is stripped on upload

Phone photos carry hidden EXIF metadata: exact GPS coordinates, time taken and phone model. Location is personal data under UK GDPR, and a builder may take a photo somewhere other than the site (their home, a supplier's yard). So every photo is decoded and re-saved with Pillow before it's stored (`strip_metadata` in `app/services/photos.py`):

- **Rotated upright first** (`ImageOps.exif_transpose`): "which way up" is stored in the same metadata, so dropping it without rotating would leave phone photos sideways.
- **Colour profile kept**, everything else dropped. JPEG/WebP are re-saved at quality 90: a slight, invisible quality loss accepted in exchange for privacy.
- **Pixel limit** (`max_photo_pixels`, 100 MP), checked from the header *before* decoding, so a "decompression bomb" (a tiny file that expands to gigabytes) is rejected with `413`.
- **Proves it's a real image**: a file that passes the magic-byte check but can't be decoded is rejected with `415`.
- Runs in a worker thread, since decoding is CPU work and would otherwise block the event loop.

The original, with its metadata, is never stored, so photos uploaded before this change are the only ones that still contain it.

## Photo responses can't be treated as web pages

`GET .../photos/{id}/file` sends `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'; sandbox`. A crafted file can start with valid image bytes and hide HTML/JavaScript inside; if a browser opened the URL directly and guessed it was a page, the script would run on the API's origin with the viewer's session. `nosniff` stops the guessing; the sandbox CSP stops scripts even if something renders. SVG is not an allowed photo type for the same reason (it can contain scripts).

Images are served with `Cache-Control: private, max-age=86400`: a photo's bytes never change (a new upload gets a new id), and `private` keeps them out of shared caches.

# Processing Doc

I added a retry to this pipeline because just cause it fails once does not mean it will fail on the next try if the error is a transient error. I have added list of some key non retryable errors so if we encounter them we do not retry which would waste worker capacity and resources.

Created a new thread for communicating with MinIO because its API calls are synchronous and could block the FastAPI event loop.

Added reaper to recover documents stuck mid-processing. If a worker crashes hard (SIGKILL, power loss), the job stays in PROCESSING forever.
The reaper runs every 30s and resets any PROCESSING job where updated_at hasn't changed for 10+ minutes back to QUEUED so the
poller re-dispatches it. Jobs that exceed max attempts are marked FAILED and their MinIO object is deleted.

# Multiple users update DOC Metadata at same time

I will update metadata using partial updates, changing only the fields the user modified rather than replacing the entire metadata object on every request. If we updated all fields on each request, a concurrent request containing stale values could overwrite newer data. With partial updates, stale unchanged fields are never written back, so concurrent changes to different fields are preserved. PostgreSQL coordinates concurrent updates to the same row.

Another option would be optimistic locking, but that would add additional complexity for what we want to acheive. Since we are only updating the fields that actually changed, optimistic locking is not necessary unless we need to detect and prevent concurrent updates to the same field. In this case, updating data does not rely on previous data so it is not strictly needed.

# LLM Rate Limiting

Single API key means all users share one OpenAI RPM/TPM quota. Three controls protect it:

**Query rate limit** — `POST /query` is capped at 20 requests/minute **per user** via slowapi/Redis. Each query costs 2 OpenAI calls (embed + chat). 20/min allows ~1 query every 3 seconds — fine for interactive use, stops scripted abuse. It was per-IP at first, but a site office or household shares one IP, so one busy person blocked everyone there; keying by user fixes that. To handle more users, upgrade OpenAI tier or add a second API key to multiply quota.

**Upload rate limit** — new documents and new versions share one 30/minute per-user bucket. Each upload can store 100 MB and trigger OCR plus hundreds of embedding calls, so a runaway script or bulk upload could otherwise run up the OpenAI bill and fill the 5-slot worker queue for everyone. See `docs/technical-design.md` → Rate limiting for the full table.

**Worker concurrency cap** — ARQ limited to 5 concurrent jobs (`max_jobs=5`). One document can produce 100+ embedding batches; 10 simultaneous uploads without a cap would blast the embeddings RPM limit. The 6th job waits in Redis — no work lost. 5 jobs × 100 chunks ≈ 500 embedding calls/min, within tier 1 limits. Raise in `config.py` as tier increases.

**Worker 429 retry** — Generic transient retry delay is 10s, too short for OpenAI's 60s rate limit window. Explicit `openai.RateLimitError` branch defers retry by 60s. `MAX_TRIES` raised 3→4 to allow three retries (up to 3 min total) before permanent failure. Worker SDK `max_retries` also raised 2→4 — these are silent client-level retries before ARQ sees the error, safe to increase since worker jobs are not user-facing.

# Rate Limiting: How It Works

What's limited and why is in `docs/technical-design.md` → Rate limiting. This section explains the mechanics and the trade-offs.

## Keys and counters

Each limit is a counter in Redis. The **key** is the counter's name, and it decides whose budget a request uses:

- `ip:203.0.113.7`: login, where nobody is signed in yet
- `user:805b9b6a-…`: search and uploads
- `session:ba7816bf…`: the backstop (a hash of the session cookie, so raw tokens never become Redis keys)

Every request adds 1 to its counter **before** the endpoint runs, so rejected requests (wrong file type, duplicate file, wrong password) still count. Over the limit returns `429`. Each counter expires at the end of its window, so Redis deletes it automatically and nothing needs cleaning up.

Counters live in Redis rather than in the API's memory because the API runs 2 uvicorn processes. With in-memory counts, each process would count separately and every user would effectively get double their limit.

## How the user reaches the key function

slowapi calls the key function with only the request, not the current user. So `get_current_user` (`app/dependencies.py`) stores the id on the request (`request.state.user_id`), and `user_key` (`app/limiter.py`) reads it. This works because slowapi's route decorator runs after FastAPI has resolved dependencies. `request.state` is scratch space for a single request and is discarded when the request ends.

## Per user, not app-wide

One shared counter for the whole app would let a single misbehaving client use up everyone's budget, and the rate limiter itself would become the outage. With a counter per user (or per session), a client can only ever block itself; everyone else is unaffected.

## Login uses two counters

| Counter                                         | Goes up on               | Limit              | Resets                                                      |
| ----------------------------------------------- | ------------------------ | ------------------ | ----------------------------------------------------------- |
| Rate limit, per IP                              | Every attempt, any email | 20/min → `429`     | After 1 minute                                              |
| Failure count, per email (`login_fail:{email}`) | Wrong password only      | 5 → locked (`429`) | 15 minutes after the last failure, or on a successful login |

Trade-offs, accepted while accounts are invited by an admin:

- **Shared IP.** People on the same office Wi-Fi share the 20/min login budget, so one person repeatedly mistyping briefly slows the others.
- **Lockout abuse.** Anyone who knows an email can type 5 wrong passwords and lock that account for 15 minutes. If this becomes a problem: shorten the lockout, add a CAPTCHA after a few failures, or don't count failures from IPs that have logged into that account before.

## The backstop isn't DDoS protection

The 300/min backstop catches a signed-in client stuck in a loop (e.g. a page refetching endlessly). It can't stop a traffic flood: a DDoS comes from thousands of IPs, each under any per-key limit, and even requests answered with `429` still use the server's network, CPU and connections. Flood protection has to sit in front of the app (Cloudflare, or a reverse proxy with connection limits).

## Redis is in-memory and disposable

Redis keeps its data in RAM, which is why a counter update takes microseconds, fast enough to do on every request. The compose setup uses Redis defaults: periodic snapshots, no append-only log, and no Docker volume. So data survives `docker compose restart` but not `docker compose down`.

That's intended. Redis only holds data that's safe to lose; anything that matters is in Postgres:

| In Redis            | If lost                                                            |
| ------------------- | ------------------------------------------------------------------ |
| Rate-limit counters | Everyone's count resets (they expire within a minute anyway)       |
| Login lockouts      | A locked email is unlocked early                                   |
| Queued jobs         | The poller re-enqueues jobs still `QUEUED` in Postgres within 30 s |

For production, set a memory cap (e.g. `maxmemory 256mb` with `maxmemory-policy volatile-lru`). It's currently uncapped, so Redis could in theory grow until the machine runs out of memory.

# Concurrency & Infrastructure Sizing

## Uvicorn Workers (HTTP)

The backend runs with `--workers 2`, meaning two separate Python processes each with their own asyncio event loop. A single worker handles I/O-bound work (DB queries, Redis, MinIO) efficiently via async, but bcrypt password hashing is CPU-bound and blocks the event loop while it runs. A second worker means bcrypt on one process does not delay unrelated requests on the other. Two workers were chosen rather than four because each worker holds its own DB connection pool, and the total connection count across all workers must stay within PostgreSQL's `max_connections` limit.

## ARQ Worker (Background Jobs)

The ARQ worker is a separate container that has no HTTP port and never responds to user requests. Its sole job is to pull document processing jobs off the Redis queue and execute the pipeline: download from MinIO, extract text, chunk, embed, persist vectors. This is kept separate from the HTTP workers because the pipeline is slow (seconds to minutes depending on document size) and must not block API responses. One ARQ worker is sufficient for the current load — document processing is not on the critical path for the user, and ARQ supports horizontal scaling (add more worker containers) if throughput needs to increase.

## Database Connection Pool

SQLAlchemy's default pool is `pool_size=5, max_overflow=10` giving 15 maximum connections per process. At 200 concurrent users all making authenticated requests, 15 connections causes severe queuing — requests wait up to 30 seconds for a connection to free up, resulting in timeouts and failures.

The pool is set to `pool_size=30, max_overflow=20` (50 max per worker). With 2 HTTP workers this means up to 100 connections to PostgreSQL. The ARQ worker and poller/reaper also hold connections, bringing the realistic peak to around 110–120. PostgreSQL `max_connections` is set to 200 to give headroom.

`pool_recycle=1800` closes and reopens connections older than 30 minutes to prevent stale connections after network interruptions. `pool_pre_ping=True` tests each borrowed connection before use and discards it if dead, preventing errors from being surfaced to users.

The right long-term solution at higher scale is PgBouncer — a connection pooler that sits in front of PostgreSQL and multiplexes thousands of application connections down to a small number of real database connections, since PostgreSQL is memory-intensive per connection (~5–10 MB RAM each).

# Frontend: TanStack Query for Server State

Pages (`documents`, `versions`, `search`) are `"use client"`, fetching client-side

Each page was hand-rolling `useState` x3 (data/loading/error) + `useEffect` fetch + try/catch mutations + callback props (`onUploaded`) just to trigger refetch. Replaced with `useQuery`/`useMutation` (`src/hooks/`):

- Less state — `isPending`/`isError`/`data` from hook, no manual triple-state per page
- `invalidateQueries` on mutation success replaces callback-prop refetch
- Free cache/dedupe — revisit page = instant stale data, shared key = one request not N

# Frontend: axios for API Calls

All API calls go through one axios instance (`src/lib/api/axiosClient.ts`) instead of `fetch`. axios rejects non-2xx responses automatically, parses JSON, builds query strings from `params`, and lets the browser set the multipart header for `FormData` uploads. The interceptor gives one place to turn errors into `ApiError` and handle expired sessions, and `onUploadProgress` makes an upload progress bar possible later. The cost is about 13 kB of bundle size.

# Frontend: Error Handling

- **401** — global, one place: the axios response interceptor (`src/lib/api/axiosClient.ts`) clears the `eo_ui_auth` cookie and does a full-page redirect to `/login`, then never settles the request so screens don't flash an error. `/auth/login` and `/auth/logout` are excluded, so a wrong password still shows "Invalid credentials".
- **Everything else (403/404/409/413/415/422/429/503/network)** — inline, next to the failing action. `getErrorMessage()`/`firstErrorMessage()` (`src/lib/errorMessage.ts`) pull the message off `ApiError`, rendered via `<ErrorAlert>`.
- **422 array-shaped detail** — FastAPI's auto Pydantic validation sends `detail` as `[{msg, loc, type}]`, not a string. `extractErrorDetail()` (`src/lib/api/apiError.ts`) joins the `msg` fields instead of stringifying the array.
- **429 body shape** — slowapi default returns `{"error": ...}`; backend's custom handler (`main.py`) normalizes to `{"detail": ...}` to match every other endpoint.
- **Unmatched routes** — `src/app/not-found.tsx`. Not an error, a routing miss.
- **Render crashes** — two nested Error Boundaries: `src/app/(protected)/error.tsx` (keeps sidebar alive) and `src/app/error.tsx` (catches `/login` and outside). Only catch thrown render exceptions, not API errors or 404s.

# Projects and Access

## Access by project membership

Builders and clients only see projects they've been added to (`project_members`), and every document query is filtered to those projects in SQL. This matches how a design-and-build company works: everyone on a job needs that job's drawings and calcs, and nobody else should see them — especially homeowners, who must never see another client's project. Per-document permissions were not added because they'd create admin work without matching that model.

## Team management is admin-only

The Team page, project member lists and role changes are restricted to admins (`require_admin`), in the API as well as the UI. Builders and clients have no need for a staff directory, and showing clients other people's emails would be a privacy leak. Admins can't change their own role, so the last admin can't lock themselves out.

## Integer project ids

Projects started with text ids like `p-101`, generated by hand-written "max + 1" code that could collide under concurrent creates. They're now a plain auto-increment identity column. Ids are guessable, which is acceptable because every project endpoint checks membership.

## Search uses current versions only

There used to be a "historical" search mode that also searched superseded versions. It was removed: on site, an answer from an out-of-date drawing or calc is worse than no answer. Version history is still kept, and an older version can be re-activated, at which point it becomes searchable again without re-processing.

# Audit Logging

## Meaningful requests are audited, in middleware

One middleware (`app/audit/middleware.py`) sees every API request, rather than each endpoint writing its own audit rows. It records changes, failed or denied requests, and document opens, and skips other successful reads (page loads, lists, polling, photo thumbnails): those were ~90% of entries and rarely answer "who did what". That makes coverage automatic: failed logins, access denied, rate-limited requests and server errors are recorded without extra code, and a new endpoint is covered without any changes. Entries are identified by method + route template (`DELETE /projects/{project_id}/photos/{photo_id}`) rather than friendly action names like `photo.deleted`: a name table would have to list every route and rely on FastAPI internals to find route prefixes, for a log only admins read. The trade-off is that the entry is written after the endpoint commits, in its own transaction: if the server dies in that instant, that one entry is lost. Accepted for full coverage from one piece of code; a sensitive change can also write inside its own transaction later if needed.

## A temp file locally, the database in production

`AUDIT_BACKEND=file` (local development) appends JSON lines to a file in the temp directory, which is fine to lose. `AUDIT_BACKEND=db` (the default, used in production) writes to `audit_events`. The automated tests always use `db`, so the code production relies on runs on every test run even though local development writes to the file.

## Append-only table

`audit_events` has no foreign keys (entries outlive deleted users and projects) and a trigger that rejects `UPDATE`, `DELETE` and `TRUNCATE`, even for the superuser the app connects as. Retention cleanup (2 years) has to disable the trigger explicitly as a privileged user. Search questions are never stored, only the result count.
