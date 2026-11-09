# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

The ExtendOut Portal (repo name `knowledgeguard`) is the project workspace for ExtendOut Design | Build, a construction company doing extensions and loft conversions. Each job is a project; admins, builders and clients share its documents, which the system chunks and embeds to answer natural-language questions with citations to the source document and version. Product docs are in `docs/` (start with `docs/overview.md`).

## Monorepo Layout

```
knowledgeguard/
├── backend/          FastAPI service (Python, uv)
├── frontend/         Next.js 14 app (TypeScript, npm)
├── playwright-tests/ E2E tests (Playwright, npm)
├── docs/             Design docs
└── docker-compose.yml  Infrastructure: PostgreSQL, Redis, MinIO
```

## Commands

### Infrastructure

```bash
docker compose up -d          # Start postgres (port 5434), Redis, MinIO
docker compose up -d postgres # Start only postgres (sufficient for backend integration tests)
```

### Backend

```bash
cd backend
uv sync --extra dev                          # Install all deps including dev
uv run uvicorn app.main:app --reload         # Dev server — http://localhost:8000
uv run ruff check .                          # Lint
uv run ruff format .                         # Format
uv run pytest tests/ -v                                                                                    # All tests
uv run pytest tests/integration/routers/test_documents.py -v                                               # Single test file
uv run pytest tests/integration/routers/test_documents.py::test_upload_creates_db_records -v               # Single test
```

**Integration tests** require postgres running (`docker compose up -d postgres`). MinIO and Redis are mocked. Tests connect to `postgresql+asyncpg://postgres:postgres@localhost:5434/knowledgeguard`.

**Alembic** (run from `backend/` with postgres running):

```bash
uv run alembic revision --autogenerate -m "description"
uv run alembic upgrade head
uv run alembic downgrade base   # drop all tables (full reset)
```

### Frontend

```bash
cd frontend
npm install
npm run dev             # Dev server — http://localhost:3000
npm run lint            # ESLint
npm run format          # Prettier (write)
npm run format:check    # Prettier (check only)
npm test                # Jest (all)
npm test -- --testPathPattern=client  # Single test file
```

### E2E Tests

```bash
cd playwright-tests
npm test                # Headless
npm run test:headed     # Visible browser
npm run test:ui         # Interactive Playwright UI
```

Requires all services running. Auth state is persisted to `.auth/user.json` by `utils/auth.setup.ts` and reused by authenticated projects. Playwright projects: `unauthenticated` (auth specs), `authenticated` (documents specs), `versions` (version history specs), `search` (search specs). Page Object Models live in `pom/`.

## Backend Architecture

### Request lifecycle

1. Cookie auth: `get_current_user()` in `app/dependencies.py` validates the `kg_session` cookie via `Session` table.
2. DB session: `get_db()` yields an `AsyncSession` per request.
3. ARQ pool: `get_arq_pool()` reads `app.state.arq_pool` (set at startup via lifespan in `main.py`).

### Document upload flow (transactional outbox pattern)

`POST /documents` in `app/routers/documents/documents.py`. The `documents/` router is a package split into `documents.py` (list/upload), `document.py` (get/patch/delete by id), `versions.py` (version endpoints), combined in `__init__.py` via `router.routes.extend()`.

1. Check project access (`ensure_project_access`) — `project_id` is required; 404 unknown project, 403 if a non-admin isn't a member.
2. Validate file type by content (allowed: pdf, docx, xlsx — docx/xlsx told apart by their zip contents).
3. Upload bytes to MinIO.
4. Insert `Document`, `DocumentVersion` (status=PROCESSING), `ProcessingJob` (status=QUEUED) — all in one DB transaction.
5. Best-effort enqueue to Redis via arq with deterministic `_job_id = f"process_document:{version.id}"`.
6. If enqueue succeeds → set job status to DISPATCHED and commit.
7. If Redis is down → job stays QUEUED; background poller retries it.

**Poller** (`app/poller.py`): runs as an `asyncio.Task` in the lifespan. Every 30 s it:
1. Calls `reap_stale_processing_jobs()` (`app/reaper.py`) — resets PROCESSING jobs stuck for 10+ min (worker hard crash) back to QUEUED; marks FAILED and deletes MinIO object if attempts exhausted.
2. Queries QUEUED jobs and enqueues them with the same deterministic `_job_id`, preventing double-enqueue via ARQ's built-in deduplication.

### Data model (key relationships)

```
User (role: admin|builder|client)
 └── ProjectMember (user_id, project_id)  ── Project (id: auto-increment integer, name)
Document (owner_id, project_id → Project)
      └── DocumentVersion (version_number, status: PROCESSING|ACTIVE|SUPERSEDED|DELETED|REVIEW_REQUIRED|FAILED)
           ├── DocumentChunk (content + Vector(1536) embedding)
           └── ProcessingJob (status: QUEUED|DISPATCHED|PROCESSING|COMPLETE|FAILED)
```

Only one `DocumentVersion` per document may have status=ACTIVE (partial unique index).

### Access control

Access is decided by **role + project membership** — document ownership has no effect:

| Action | `builder` / `client` | `admin` |
|---|---|---|
| See a project (`GET /projects`) | only projects they're a member of | all |
| Upload / list / read / edit / version / delete docs | only in member projects (403 otherwise; 404 for a doc outside them) | all |
| Query RAG | only documents in member projects (403 if `project_id` is a non-member project) | all |

Builders and clients have identical document permissions. Rules live in `app/services/permissions.py`: `document_access_filters(user)` (WHERE clauses for all document routes), `ensure_project_access(db, user, project_id)` (404 unknown project / 403 non-member), `build_permitted_doc_ids(user, project_id)` (RAG). Documents with `project_id IS NULL` (legacy, pre-projects) are admin-only.

There is no public sign-up. Admins create accounts with `POST /team` (`email`, `password`, `role`: `admin|builder|client`, optional `name`; role enforced by `ck_users_role`).

Team management is **admin only** (`app/routers/team.py`, `app/routers/project_members.py`, all guarded by `require_admin` in `app/dependencies.py`). The frontend hides the Team sidebar link (`adminOnly` in `navConfig.ts`) and each project's Team tab from builders/clients.
- `GET /team` — every user with their `project_ids`.
- `POST /team` `{email, password, role, name?}` — create an account (the only way accounts are made).
- `PATCH /team/{user_id}` `{role}` — admins can't change their own role.
- `GET /projects/{id}/members`, `POST /projects/{id}/members` `{user_id}`, `DELETE /projects/{id}/members/{user_id}`.

### Worker

`app/workers/main.py` — arq `WorkerSettings`. `process_document` pipeline:
1. Mark `ProcessingJob` PROCESSING, load `DocumentVersion`.
2. Download raw bytes from MinIO (`run_in_executor` — sync client).
3. Detect content type → extract text (`app/services/extractor.py`).
4. Chunk text (`app/services/chunker.py`).
5. Generate OpenAI embeddings (`app/services/embedder.py`).
6. `persist_results` (`app/workers/persistence.py`) — insert `DocumentChunk` rows, update search vector, supersede old ACTIVE version, activate new version — all in one transaction.

On error: `app/utils/worker_errors.py` classifies retryable vs non-retryable. Non-retryable (`ValueError`, `openai.AuthenticationError`, `openai.BadRequestError`) → immediate FAILED. Retryable → `raise Retry(defer=N)` up to `MAX_TRIES`. Permanent failure calls `persist_failure` (`app/workers/failure.py`) which also deletes the MinIO object.

Shared retry constant: `app/workers/constants.py` (`MAX_TRIES`, `RETRY_DELAYS`) — used by both worker and reaper.

Run worker: `uv run arq app.workers.main.WorkerSettings` (or via Docker: `worker` service in docker-compose).

### Query pipeline

`POST /query` in `app/routers/query.py` — full RAG pipeline:
1. Embed question via `app/services/embedder.py`.
2. Parallel vector search (`app/services/vector_search.py`) + FTS (`app/services/fts_search.py`).
3. Fuse results via RRF (`app/services/rrf.py`), filtered to permitted documents via `build_permitted_doc_ids` (`app/services/permissions.py`). Both searches only include `ACTIVE` versions — there is no historical mode.
4. Build context string (`app/services/context_builder.py`).
5. Call LLM (`app/services/llm.py`) — `gpt-4o-mini` by default (`config.chat_model`).
6. Return `QueryResponse` with citations.

## Frontend Architecture

Next.js 14 App Router. All pages under `src/app/`. API calls go through the shared axios instance `api` in `src/lib/api/axiosClient.ts` (`withCredentials: true` for session cookie passthrough). Its response interceptor turns non-2xx responses into `ApiError` (`src/lib/api/apiError.ts`) and redirects to `/login` on a 401 (except from `/auth/login` / `/auth/logout`). Jest tests stub the transport with `src/test-utils/mockApi.ts`. Types in `src/types/index.ts` mirror the backend data model.

Protected pages live under `src/app/(protected)/` with a shared layout. `/login` is the only public page. Middleware in `src/proxy.ts` handles auth redirects. Post-login redirect lands on `/dashboard`.

UI components are shadcn/ui (in `src/components/ui/`). Navigation is `src/components/nav/Sidebar.tsx`.

## Test Patterns

### Backend integration tests

Tests live in `backend/tests/`. Structure:
- `tests/integration/routers/` — router-level integration tests
- `tests/integration/processing/` — worker/document processing pipeline tests
- `tests/services/` — unit tests for individual services

- Shared fixtures in `tests/fixtures/` (`db.py`, `auth.py`, `arq.py`), loaded via `pytest_plugins` in `tests/conftest.py` (top-level — NOT in `tests/integration/conftest.py`)
- `auth.py` provides `test_user` (role=builder, member of `TEST_PROJECT_ID`) and `admin_user`/`admin_client` (role=admin) fixtures, plus `make_project(member=...)` for extra projects (pass `member=None` for a project the user can't access)
- `override_db` is autouse — patches `get_db` for every test
- `_arq_app_state` is autouse — sets `app.state.arq_pool` (lifespan doesn't run in ASGI tests)
- `mock_pool` overrides the `get_arq_pool` dependency; use when a test needs to assert on `enqueue_job` calls
- Engine created with `NullPool` — required so asyncpg binds to the per-test event loop
- Processing tests (`tests/integration/processing/`) have their own `conftest.py` that patches `AsyncSessionLocal` in `workers/main.py`, `workers/persistence.py`, and `workers/failure.py` with a NullPool factory to avoid connection-reuse errors across test event loops

### Frontend unit tests

Jest with jsdom. Config in `frontend/jest.config.js`. Module alias `@/` maps to `src/`.
