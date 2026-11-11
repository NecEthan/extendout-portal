# Architecture

## System overview

```
┌──────────────────────────────────────┐
│               Browser                │
│   Next.js 14 (App Router, client)    │
└──────────────────┬───────────────────┘
                   │ HTTP / REST (cookies: credentials: "include")
                   ▼
┌──────────────────────────────────────┐
│        FastAPI (uvicorn, 2 workers)  │
│                                      │
│ Auth │ Projects │ Team │ Documents │ │
│ Query │ Health                       │
│                                      │
│ + poller / reaper (asyncio task)     │
└──┬──────────┬──────────┬─────────┬───┘
   │          │          │         │
   ▼          ▼          ▼         ▼
┌────────┐ ┌───────┐ ┌───────┐ ┌────────┐
│Postgres│ │ Redis │ │ MinIO │ │ OpenAI │
│pgvector│ │       │ │ files │ │  API   │
└────────┘ └───┬───┘ └───────┘ └────────┘
               │ jobs
               ▼
        ┌─────────────┐
        │ ARQ worker  │  max_jobs = 5
        └─────────────┘
```

One instance of each service, all started with `docker compose up -d`. Vector search lives in Postgres (pgvector) next to the relational data — there is no separate vector database, reranking model or external document connector.

## Data model

```
User (role: admin | builder | client, optional name)
 └── ProjectMember (project_id, user_id)  ── Project (id: integer, name, client, address)
                                               │
Document (title, owner_id, project_id) ────────┘
 └── DocumentVersion (version_number, status, content_hash, storage_key)
      ├── DocumentChunk (content, embedding vector(1536))
      └── ProcessingJob (status: QUEUED | DISPATCHED | PROCESSING | COMPLETE | FAILED)

Session (server-side login sessions)
```

- **Version status:** `PROCESSING | ACTIVE | SUPERSEDED | DELETED | REVIEW_REQUIRED | FAILED`. A partial unique index allows only one `ACTIVE` version per document.
- **Documents without a project** (`project_id IS NULL`, from before projects existed) are visible to admins only.
- **Storage:** Postgres holds metadata, chunks and embeddings; MinIO holds the original uploaded files; Redis holds the job queue and rate-limit counters.

## Access control

Decided on every request by the backend — the frontend only hides what a user can't use.

| Action | builder / client | admin |
|---|---|---|
| See projects | Projects they're a member of | All |
| Upload / list / read / edit / version / delete documents | Only in member projects | All |
| AI search | Only documents in member projects | All |
| Create / edit projects | — | ✓ |
| Team page, project members, change roles | — | ✓ |

Rules live in `backend/app/services/permissions.py` (`document_access_filters`, `ensure_project_access`, `build_permitted_doc_ids`). Admin-only routes use `require_admin` in `backend/app/dependencies.py`.

## Document upload and processing (transactional outbox)

```
POST /documents (multipart: file, title, project_id)
       │
       ▼
  check project access → validate file type & size → upload bytes to MinIO
       │
       ▼
┌─────────────────────────────────────────┐
│ One DB transaction:                      │
│  - insert Document                       │
│  - insert DocumentVersion (PROCESSING)   │
│  - insert ProcessingJob (QUEUED)         │
└──────────────────┬──────────────────────┘
                   ▼
   best-effort enqueue to Redis (arq)
   deterministic job id: process_document:{version_id}
          ┌────────┴────────┐
          ▼ success          ▼ Redis down
   job → DISPATCHED     job stays QUEUED
                              │
                              ▼
            Poller (every 30 s) re-enqueues QUEUED jobs;
            arq dedupes on the job id
                              │
                              ▼
┌──────────────────────────────────────────┐
│ ARQ worker                               │
│  1. mark job PROCESSING                  │
│  2. download file from MinIO             │
│  3. extract text (OCR for scanned PDFs)  │
│  4. chunk (~500 tokens, ~50 overlap)     │
│  5. embed (OpenAI text-embedding-3-small)│
│  6. one DB transaction: insert chunks,   │
│     update full-text index, supersede    │
│     the old ACTIVE version, activate new │
└──────────────────────────────────────────┘
```

**Reaper** (same 30 s loop): resets jobs stuck in `PROCESSING` for 10+ minutes back to `QUEUED` (worker crash recovery). Once retries are exhausted it marks the job `FAILED` and deletes the MinIO object.

## AI search (query flow)

```
POST /query { question, project_id }
       │
       ▼
  Session auth → project access check (403 if not a member)
       │
       ▼
  Embed question (OpenAI)
       │
       ├────────────────────┬────────────────────┐
       ▼                    ▼                    │
 Vector search        Full-text search           │  both limited to:
 (pgvector cosine)    (Postgres tsvector)        │  - permitted documents
       │                    │                    │  - ACTIVE versions only
       └─────────┬──────────┘                    │
                 ▼                               │
       Reciprocal Rank Fusion ◄──────────────────┘
                 ▼
       Context assembly (title, version, status per chunk)
                 ▼
       gpt-4o-mini (JSON output, validated with Pydantic)
                 ▼
       Answer + citations
```

Search only ever uses **current** versions. Superseded versions keep their chunks so they're searchable again immediately if re-activated, but they're filtered out of every query.

## Frontend

- **Pages** live in `frontend/src/app/`. Protected pages are under `(protected)/` with a shared layout (sidebar + top bar). `/login` is public.
- **Route guard:** no middleware. Every protected page loads the current user (`useUser`); a `401` makes the axios interceptor redirect to `/login`. The login page sends an already-logged-in user to `/dashboard`. The backend checks the session on every request; the frontend redirects are only convenience.
- **Server state:** TanStack Query hooks in `src/hooks/`. API calls go through `src/lib/api/client.ts` with `credentials: "include"`.
- **Errors:** a 401 anywhere redirects to `/login` (handled once in `QueryProvider`); other errors show inline with `ErrorAlert`.
- **Feature code** sits next to the page that uses it, e.g. `projects/add/`, `projects/edit/`, `projects/[id]/components/`.

## Infrastructure

```
docker-compose.yml
├── postgres   pgvector/pgvector:pg16 (port 5434 on the host)
├── redis      redis:7-alpine — job queue + rate-limit counters
├── minio      file storage (ports 9010 / 9011 console)
├── backend    FastAPI, uvicorn --workers 2 (port 8000)
├── worker     same image, `arq app.workers.main.WorkerSettings`
└── frontend   Next.js dev server (port 3000, source mounted for hot reload)
```

`backend/app` is mounted into the backend and worker containers, but neither auto-reloads (uvicorn runs without `--reload`). After backend changes run `docker compose restart backend worker`; rebuild (`--build`) only when dependencies change.
