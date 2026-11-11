# To Do

## Rate limiting

Done — see `docs/technical-design.md` → Rate limiting for the final setup (login per IP, query and uploads per user, 300/min per-session backstop).

- [x] **Per-user upload limit.** Limit `POST /documents` and `POST /documents/{id}/versions` to roughly 20–30 per minute per user. Uploads are now the most expensive unlimited action: one request can push 50 MB into MinIO and trigger OCR plus hundreds of OpenAI embedding calls in the worker.
- [x] **Move the query limit to per-user.** Key `POST /query` by user id rather than IP (`app/limiter.py`), so people sharing one IP (a site office, a household) don't share a budget. Login stays per-IP + per-email, since there's no user yet.
- [x] **Optional: global backstop.** A high default limit on all endpoints, e.g. 300/min per user, to catch a runaway client stuck in a loop. Keep it well above normal use: the documents tab polls every 3 seconds (~20/min per open tab). Exempt `/health`, which Docker checks constantly.

Leave everything else alone: authenticated reads are cheap and scoped to your own projects, and admin actions are few and trusted.

**What app limits can't do:** stop a real flood of traffic (a DDoS). That has to be stopped before it reaches FastAPI, by a reverse proxy or a service like Cloudflare in production. App-level limits are for cost and abuse control, not traffic floods.

## Lock down production services (before deploying)

`docker-compose.prod.yml` publishes Postgres (`5436`), Redis (`6381`) and MinIO (`9014`/`9015`) on the host, with default credentials (`postgres`/`postgres`, `minioadmin`/`minioadmin`, Redis with no password). On an internet-facing server, anyone could log in directly and read or delete every user, project, document and photo (including the audit log), bypassing the app's permission checks, rate limits and audit logging entirely.

- [ ] Remove the `ports:` entries for `postgres`, `redis` and `minio` in `docker-compose.prod.yml`. The backend and worker reach them over Docker's internal network; nothing else needs them. (For manual access use `docker compose -f docker-compose.prod.yml --env-file .env.prod exec postgres psql ...`.)
- [ ] Set strong, unique passwords in `.env.prod` and use them in the compose file instead of the defaults: `POSTGRES_PASSWORD` (and the matching `DATABASE_URL`), `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` (and `STORAGE_ACCESS_KEY`/`STORAGE_SECRET_KEY`), and a Redis password (`requirepass`, plus `REDIS_URL`).
- [ ] Firewall the server so only 80/443 (and SSH, ideally restricted) are reachable.
- [ ] Fix `make prod-down`: it doesn't pass `--env-file .env.prod`, so it targets the wrong project name and doesn't stop the prod containers.

## Login error messages

- [ ] Fix the login error messages for the account lock and "try again in 1 minute".

## Replace MinIO in production

MinIO currently runs locally in Docker (`minio` service, `minio_data` volume). For production, move file storage to a hosted S3-compatible service (AWS S3, Cloudflare R2 or Backblaze B2) so we don't have to run, back up and secure our own storage server.

- [ ] Pick a provider and create the bucket (private, no public access).
- [ ] Point the backend and worker at it: `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET`. The code uses the S3 API through the `minio` Python client, which works with any S3-compatible endpoint.
- [ ] Turn on server-side encryption at rest for the bucket (see *Storage is not encrypted at rest* in `docs/engineering-decisions.md`).
- [ ] Use credentials scoped to this one bucket, not account-wide keys.
- [ ] Copy existing files across from MinIO, keeping the same object keys (`documents/<uuid>` and `photos/<uuid>`), since `storage_key` in the database points at them.

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
