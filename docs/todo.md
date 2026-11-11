# To Do

## Rate limiting

Done — see `docs/technical-design.md` → Rate limiting for the final setup (login per IP, query and uploads per user, 300/min per-session backstop).

- [x] **Per-user upload limit.** Limit `POST /documents` and `POST /documents/{id}/versions` to roughly 20–30 per minute per user. Uploads are now the most expensive unlimited action: one request can push 50 MB into MinIO and trigger OCR plus hundreds of OpenAI embedding calls in the worker.
- [x] **Move the query limit to per-user.** Key `POST /query` by user id rather than IP (`app/limiter.py`), so people sharing one IP (a site office, a household) don't share a budget. Login stays per-IP + per-email, since there's no user yet.
- [x] **Optional: global backstop.** A high default limit on all endpoints, e.g. 300/min per user, to catch a runaway client stuck in a loop. Keep it well above normal use: the documents tab polls every 3 seconds (~20/min per open tab). Exempt `/health`, which Docker checks constantly.

Leave everything else alone: authenticated reads are cheap and scoped to your own projects, and admin actions are few and trusted.

**What app limits can't do:** stop a real flood of traffic (a DDoS). That has to be stopped before it reaches FastAPI, by a reverse proxy or a service like Cloudflare in production. App-level limits are for cost and abuse control, not traffic floods.

## Login error messages

- [ ] Fix the login error messages for the account lock and "try again in 1 minute".

## Store session tokens hashed

The session ID in the `eo_session` cookie is stored as-is in `sessions.session_token` (`create_session` in `app/services/auth.py`). Anyone with a copy of the database (e.g. a leaked backup) could use those values to log in as any user with a live session. Do this before lengthening sessions beyond 24 hours, since tokens would stay valid much longer.

- [ ] Store `sha256(token)` instead of the token: `create_session` still returns the raw token for the cookie, but saves only its hash; `get_valid_session` and `invalidate_session` hash the cookie value before looking it up. (SHA-256 is enough: tokens are 32 random bytes, so no salt or slow hash is needed.)
- [ ] Migration: rename/repurpose the column (e.g. `session_token_hash`) and delete existing sessions (everyone logs in once), since old raw tokens can't be converted into usable hashes.
- [ ] Tests: the stored value is not the cookie value; login, authenticated requests and logout still work; a request using the stored hash as a cookie is rejected.
- [ ] Update `tests/fixtures/auth.py`, which inserts `Session(session_token=token)` directly.

## Replace MinIO in production with a Railway Storage Bucket

Production files (documents, drawings, site photos) are stored by a self-hosted MinIO service on Railway (`Bucket` service + `Console`), on a single volume with no backups, a 5 GB Hobby default size, and public domains it doesn't need. Decision: move to Railway's built-in **Storage Buckets** (S3-compatible, $0.015/GB-month on Pro, unlimited capacity, one bill, private access from the backend). Spending is controlled by the workspace **Hard Usage Limit**. Local development keeps MinIO in Docker.

**Before switching, confirm:**
- [ ] Backups / versioning: does a Railway Bucket keep old versions or support backups? If not, add a separate nightly copy elsewhere, because a deleted or overwritten file would otherwise be lost.
- [ ] Region: the bucket must be in the EU (services run in `europe-west4`) for UK GDPR.
- [ ] What the two existing buckets are (`customizable-flask`, `functional-packetcase`): reuse one or delete them.

**Switch:**
- [ ] Create (or reuse) a private bucket in the production environment.
- [ ] Point the backend (`loving-luck`) and worker (`knowledgeguard`) at it: `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET`. The code uses the S3 API through the `minio` Python client, so no code change should be needed. Test uploads, downloads and deletes on a staging environment first.
- [ ] Copy existing files from MinIO, keeping the same object keys (`documents/<uuid>`, `photos/<uuid>`), since `storage_key` in the database points at them. Spot-check that old documents and photos still open.
- [ ] Turn on encryption at rest if Railway Buckets offer it (see *Storage is not encrypted at rest* in `docs/engineering-decisions.md`).

**Spending limit:**
- [ ] Set the workspace Hard Usage Limit well above normal monthly spend, with a usage alert at a lower amount. Hitting it suspends everything in the workspace (backend, database, storage), not just storage, so it should only trigger in an emergency.

**After switching:**
- [ ] Remove the MinIO `Bucket` and `Console` services (and their public domains and volume) once the copy is verified.
- [ ] Back up Postgres too (Railway backups or a scheduled `pg_dump`), so files and the database rows that point at them can be restored together. Test a restore once.

## Orphaned MinIO files

Orphan tagging (orphan tag + lifecycle rule) was removed because it could delete real files; see *Orphaned files in MinIO* in `docs/engineering-decisions.md`. Rare orphans (a crash between saving the file and saving its database row) are accepted for now.

- [ ] **Optional: safe clean-up job.** Only if orphans ever matter. Periodically list objects older than a day and delete those that **no database row references** (`document_versions.storage_key`, `project_photos.storage_key`). Fails safe: when unsure, keep the file. Could start as a one-off script run by hand.
- [ ] **Remove the startup clean-up call.** `remove_orphan_lifecycle_rule()` (called in `main.py`'s lifespan) deletes the old `expire-orphan-uploads` rule from the bucket. Once it has run against every environment's bucket, delete the function and the call.

## Audit logging

Done — see `docs/audit-logging-plan.md` and *Audit logging* in `docs/engineering-decisions.md`. Every API request (except `/health` and `OPTIONS`) is recorded by `app/audit/middleware.py`: to a temp file locally (`AUDIT_BACKEND=file`), to the append-only `audit_events` table in production and tests (`AUDIT_BACKEND=db`). It is not exposed in the app (no page or API): read the file locally, or query `audit_events` with a database client in production.

- [x] **Data model.** `audit_events` (migration `e7b3c9d1a5f2`): actor, method + route, status/outcome, project, entity, IP, user agent, duration, `details`. A trigger rejects `UPDATE`, `DELETE` and `TRUNCATE`.
- [x] **Meaningful actions recorded:** every change, login and search; every failed or denied request (401/403/404/429/500); document and version opens. Other successful reads are skipped.
- [x] **Searches:** only the result count is stored, never the question.
- [ ] **Same-transaction writes.** Entries are written after the request, in their own transaction (accepted trade-off). If needed, call the writer inside a sensitive change's own transaction too.
- [ ] **Production hardening** (when deploying): run `alembic upgrade head`; app DB user with only `INSERT, SELECT` on `audit_events`; ship container logs (`audit_event` lines) off-server; uvicorn `--proxy-headers --forwarded-allow-ips=<proxy>` so IPs are real; alerts later.
- [ ] **Retention.** Delete entries older than 2 years in a scheduled job run as a privileged user (it must disable the trigger), and mention the audit log in the privacy notice.
