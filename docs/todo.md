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
