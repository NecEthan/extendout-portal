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
- [ ] Check orphan cleanup works on the new provider. It relies on object tags (`kg-orphan`) and a bucket lifecycle rule set at startup (`configure_bucket_lifecycle` in `app/services/storage.py`). AWS S3 supports both; other providers may need the rule set up differently.
- [ ] Turn on server-side encryption at rest for the bucket (see *Storage is not encrypted at rest* in `docs/engineering-decisions.md`).
- [ ] Use credentials scoped to this one bucket, not account-wide keys.
- [ ] Copy existing files across from MinIO, keeping the same object keys (`documents/<uuid>`), since `storage_key` in the database points at them.
