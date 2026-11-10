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

## Replace MinIO in production

MinIO currently runs locally in Docker (`minio` service, `minio_data` volume). For production, move file storage to a hosted S3-compatible service (AWS S3, Cloudflare R2 or Backblaze B2) so we don't have to run, back up and secure our own storage server.

- [ ] Pick a provider and create the bucket (private, no public access).
- [ ] Point the backend and worker at it: `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET`. The code uses the S3 API through the `minio` Python client, which works with any S3-compatible endpoint.
- [ ] Turn on server-side encryption at rest for the bucket (see *Storage is not encrypted at rest* in `docs/engineering-decisions.md`).
- [ ] Use credentials scoped to this one bucket, not account-wide keys.
- [ ] Copy existing files across from MinIO, keeping the same object keys (`documents/<uuid>` and `photos/<uuid>`), since `storage_key` in the database points at them.

## Orphaned MinIO files

Orphan tagging (`kg-orphan` tag + lifecycle rule) was removed because it could delete real files; see *Orphaned files in MinIO* in `docs/engineering-decisions.md`. Rare orphans (a crash between saving the file and saving its database row) are accepted for now.

- [ ] **Optional: safe clean-up job.** Only if orphans ever matter. Periodically list objects older than a day and delete those that **no database row references** (`document_versions.storage_key`, `project_photos.storage_key`). Fails safe: when unsure, keep the file. Could start as a one-off script run by hand.
- [ ] **Remove the startup clean-up call.** `remove_orphan_lifecycle_rule()` (called in `main.py`'s lifespan) deletes the old `expire-orphan-uploads` rule from the bucket. Once it has run against every environment's bucket, delete the function and the call.

## Audit logging

There's no audit log yet: structured logs record requests, but not a durable "who did what, when" history (see *Observability* in `docs/technical-design.md`). For a portal holding clients' drawings, calcs and photos, the office should be able to answer questions like "who deleted that drawing?" or "who gave this person access?".

An old, empty `audit_events` table left over from a deleted migration was dropped (migration `d6a1e4b8c2f9`), so this starts from a clean slate with a new migration.

- [ ] **Data model.** One append-only table: who (`user_id`), what (`event_type`, e.g. `document.deleted`), which thing (`entity_type` + `entity_id`, plus `project_id` for filtering), when (`created_at`), and extra detail in `metadata` (old/new role, file name, IP). Never updated or deleted by the app.
- [ ] **Write it in the same transaction** as the change it describes, so a change can't happen without its audit row (and a rolled-back change leaves none).
- [ ] **Events worth recording:**
  - Documents: upload, new version, set active version, delete.
  - Photos: upload (and delete, once that exists).
  - Access: user created, role changed, added to / removed from a project.
  - Projects: created, edited.
  - Auth: login success/failure and account lockout (also useful for spotting attacks).
- [ ] **Admin view.** An audit page or per-project "History" list for admins, filterable by project, user and event type.
- [ ] **Retention.** Decide how long to keep entries (e.g. 2 years) and avoid storing more personal data than needed in `metadata` (UK GDPR).
- [ ] **Searches:** decide whether to log questions asked in Search. Useful for usage insight, but it's personal content, so probably store only counts or opt in.
