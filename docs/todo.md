# To Do

## Login error messages

- [ ] Fix the login error messages for the account lock and "try again in 1 minute".

## Store session tokens hashed

- [ ] Store `sha256(token)` instead of the token: `create_session` still returns the raw token for the cookie, but saves only its hash; `get_valid_session` and `invalidate_session` hash the cookie value before looking it up.
- [ ] Migration: rename/repurpose the column (e.g. `session_token_hash`) and delete existing sessions (everyone logs in once).
- [ ] Tests: the stored value is not the cookie value; login, authenticated requests and logout still work; a request using the stored hash as a cookie is rejected.
- [ ] Update `tests/fixtures/auth.py`, which inserts `Session(session_token=token)` directly.

## Railway

- [ ] Set `EMAIL_BACKEND=resend`, `RESEND_API_KEY` and `EMAIL_FROM` on the backend (`loving-luck`) and remove the old `EMAILJS_*` variables.
- [ ] Reset the production database (`uv run alembic downgrade base && uv run alembic upgrade head`) and re-create the admin account.
- [ ] Test: upload a document (it reaches ACTIVE), download it, search it; upload, view and delete a photo.
- [ ] Remove the MinIO `Bucket` and `Console` services, with their volume and public domains.
- [ ] Delete the unused buckets (`customizable-flask`, `functional-packetcase`) if they aren't needed.
- [ ] Add a backup cron service from the backend repo: start command `uv run python -m app.backup_bucket`, schedule `0 2 * * *`. Variables: the same `STORAGE_*` as the backend, plus `BACKUP_STORAGE_ENDPOINT=${{backups.ENDPOINT}}`, `BACKUP_STORAGE_BUCKET=${{backups.BUCKET}}`, `BACKUP_STORAGE_ACCESS_KEY=${{backups.ACCESS_KEY_ID}}`, `BACKUP_STORAGE_SECRET_KEY=${{backups.SECRET_ACCESS_KEY}}`, `BACKUP_STORAGE_REGION=${{backups.REGION}}`, `BACKUP_STORAGE_VIRTUAL_STYLE=true`, `APP_ENV=production`.
- [ ] Check the first backup run's log shows `backup_finished ... ok=True`, and that a failed run shows as failed in Railway.
- [ ] Turn on scheduled backups for the Postgres volume (daily + weekly). Test restoring a file and the database once.
- [ ] Set the workspace Hard Usage Limit well above normal monthly spend, with a usage alert at a lower amount.
- [ ] Upgrade to Pro before the Postgres volume nears Hobby's 5 GB cap.

## Orphaned files in storage

- [ ] Optional: a job that deletes objects older than a day that no database row references (`document_versions.storage_key`, `project_photos.storage_key`). When unsure, keep the file.

## Audit logging

- [ ] Optional: write audit entries inside a sensitive change's own transaction.
- [ ] Production hardening: app DB user with only `INSERT, SELECT` on `audit_events`; ship container logs (`audit_event` lines) off-server; uvicorn `--proxy-headers --forwarded-allow-ips=<proxy>` so IPs are real; alerts later.
- [ ] Retention: delete entries older than 2 years in a scheduled job run as a privileged user (it must disable the trigger), and mention the audit log in the privacy notice.
