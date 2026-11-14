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

Production files (documents, drawings, site photos) were stored by a self-hosted MinIO service on Railway (`Bucket` service + `Console`), on a single volume with no backups. Decision: move to Railway's built-in **Storage Buckets** (S3-compatible, private, encrypted at rest, $0.015/GB-month; 1 TB cap on Hobby, unlimited on Pro). Local development and CI keep MinIO in Docker. Existing production files are **not** copied over: the current documents and photos aren't needed, so the production database is reset instead.

**Code (done):** `STORAGE_REGION` and `STORAGE_VIRTUAL_STYLE` settings; the old lifecycle-rule startup call removed (Railway buckets don't support lifecycle rules); nightly backup `app/backup_bucket.py`. See *File storage* in `docs/engineering-decisions.md`.

**Switch (Railway dashboard):**
- [ ] Create a private bucket in the production environment, in the EU region. Delete the unused buckets (`customizable-flask`, `functional-packetcase`) if they aren't needed.
- [ ] Set on the backend (`loving-luck`) and worker (`knowledgeguard`), as variable references to the bucket: `STORAGE_ENDPOINT=${{Bucket.ENDPOINT}}`, `STORAGE_BUCKET=${{Bucket.BUCKET}}`, `STORAGE_ACCESS_KEY=${{Bucket.ACCESS_KEY_ID}}`, `STORAGE_SECRET_KEY=${{Bucket.SECRET_ACCESS_KEY}}`, `STORAGE_REGION=${{Bucket.REGION}}`, and `STORAGE_VIRTUAL_STYLE=true` (or `false` if the bucket's Credentials tab says path-style).
- [ ] Reset the production database (`uv run alembic downgrade base && uv run alembic upgrade head`) and re-create the admin account.
- [ ] Test: upload a document (it reaches ACTIVE), download it, search it; upload, view and delete a photo.
- [ ] Remove the MinIO `Bucket` and `Console` services, with their volume and public domains.

**Backups:**
- [ ] Create a second bucket in the production environment (e.g. `Backups`), in the EU region.
- [ ] Add a cron service from the backend repo: start command `uv run python -m app.backup_bucket`, schedule `0 2 * * *` (02:00 UTC). Give it the same `STORAGE_*` variables as the backend plus the backup bucket as variable references: `BACKUP_STORAGE_ENDPOINT=${{Backups.ENDPOINT}}`, `BACKUP_STORAGE_BUCKET=${{Backups.BUCKET}}`, `BACKUP_STORAGE_ACCESS_KEY=${{Backups.ACCESS_KEY_ID}}`, `BACKUP_STORAGE_SECRET_KEY=${{Backups.SECRET_ACCESS_KEY}}`, `BACKUP_STORAGE_REGION=${{Backups.REGION}}`, `BACKUP_STORAGE_VIRTUAL_STYLE=true`. `APP_ENV=production` for JSON logs. It needs no database, Redis or email settings.
- [ ] Check the first run's log shows `backup_finished ... ok=True`, and that a failed run shows as failed in Railway.
- [ ] Turn on scheduled backups for the Postgres volume (daily + weekly). Test restoring a file and the database once.

**Spending limit:**
- [ ] Set the workspace Hard Usage Limit well above normal monthly spend, with a usage alert at a lower amount. Hitting it suspends everything in the workspace (backend, database, storage), not just storage, so it should only trigger in an emergency.
- [ ] Upgrade to Pro before the Postgres volume nears Hobby's 5 GB cap (extracted text and embeddings grow with every document).

## Orphaned files in storage

Orphan tagging (orphan tag + lifecycle rule) was removed because it could delete real files; see *Orphaned files in MinIO* in `docs/engineering-decisions.md`. Rare orphans (a crash between saving the file and saving its database row) are accepted for now.

- [ ] **Optional: safe clean-up job.** Only if orphans ever matter. Periodically list objects older than a day and delete those that **no database row references** (`document_versions.storage_key`, `project_photos.storage_key`). Fails safe: when unsure, keep the file. Could start as a one-off script run by hand.
- [x] **Remove the startup clean-up call.** `remove_orphan_lifecycle_rule()` was deleted with the move to a Railway bucket (no lifecycle rules there).

## Audit logging

Done — see `docs/audit-logging-plan.md` and *Audit logging* in `docs/engineering-decisions.md`. Every API request (except `/health` and `OPTIONS`) is recorded by `app/audit/middleware.py`: to a temp file locally (`AUDIT_BACKEND=file`), to the append-only `audit_events` table in production and tests (`AUDIT_BACKEND=db`). It is not exposed in the app (no page or API): read the file locally, or query `audit_events` with a database client in production.

- [x] **Data model.** `audit_events` (migration `e7b3c9d1a5f2`): actor, method + route, status/outcome, project, entity, IP, user agent, duration, `details`. A trigger rejects `UPDATE`, `DELETE` and `TRUNCATE`.
- [x] **Meaningful actions recorded:** every change, login and search; every failed or denied request (401/403/404/429/500); document and version opens. Other successful reads are skipped.
- [x] **Searches:** only the result count is stored, never the question.
- [ ] **Same-transaction writes.** Entries are written after the request, in their own transaction (accepted trade-off). If needed, call the writer inside a sensitive change's own transaction too.
- [ ] **Production hardening** (when deploying): run `alembic upgrade head`; app DB user with only `INSERT, SELECT` on `audit_events`; ship container logs (`audit_event` lines) off-server; uvicorn `--proxy-headers --forwarded-allow-ips=<proxy>` so IPs are real; alerts later.
- [ ] **Retention.** Delete entries older than 2 years in a scheduled job run as a privileged user (it must disable the trigger), and mention the audit log in the privacy notice.
