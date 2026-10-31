# Production Architecture

## System Overview

```
┌─────────────────────────────────┐
│            Browser               │
│   Next.js (App Router, CSR)     │
└────────────────┬────────────────┘
                 │ HTTP / REST (credentials: include)
                 ▼
┌─────────────────────────────────┐
│         FastAPI (Uvicorn)        │
│   2 worker processes, 1 container│
│                                  │
│  Auth │ Documents │ Query │ Health│
└──┬──────────┬────────┬─────┬─────┘
   │          │        │     │
   ▼          ▼        ▼     ▼
┌────────┐ ┌───────┐ ┌─────┐ ┌───────┐
│Postgres│ │ Redis │ │MinIO│ │OpenAI │
│+pgvector│ │       │ │     │ │(API) │
└───┬────┘ └───┬───┘ └─────┘ └───────┘
    │          │
    │          ▼
    │   ┌─────────────┐
    │   │  ARQ Worker  │  ← 1 container, max_jobs=5
    │   └─────────────┘
    │
    ▼ (poller + reaper, asyncio tasks inside FastAPI)
```

Single instance of every service. No load balancer, no CDN, no Postgres replica, no Qdrant/dedicated vector DB (pgvector column on `document_chunks`), no horizontal auto-scaling. Everything runs via `docker compose up`.

---

## Document Upload and Processing (transactional outbox)

```
POST /documents
       │
       ▼
┌─────────────────────────────────────────┐
│ One DB transaction:                      │
│  - insert Document                       │
│  - insert DocumentVersion (PROCESSING)   │
│  - insert ProcessingJob (QUEUED)         │
└──────────────────┬────────────────────────┘
                   │
                   ▼
       best-effort enqueue to Redis (arq)
       deterministic job id: process_document:{version_id}
                   │
          ┌────────┴────────┐
          ▼ success          ▼ Redis down
   job → DISPATCHED     job stays QUEUED
                               │
                               ▼
                    Poller (every 30s, asyncio task
                    in FastAPI lifespan) re-enqueues
                    QUEUED jobs — arq dedupes by job id
                               │
                               ▼
┌──────────────────────────────────┐
│           ARQ Worker              │
│  1. download file from MinIO      │
│  2. extract text                  │
│  3. chunk                         │
│  4. embed (OpenAI)                │
│  5. insert chunks, supersede old  │
│     version, activate new one —   │
│     one DB transaction            │
└──────────────────────────────────┘
```

Reaper (same 30s poller loop) resets any job stuck in `PROCESSING` for 10+ minutes back to `QUEUED` (worker crash recovery); marks `FAILED` and deletes the MinIO object once retries are exhausted. Retryable vs non-retryable errors classified in `app/utils/worker_errors.py`.

---

## Query Flow

```
POST /query
       │
       ▼
  Auth (session cookie → Postgres Session table)
       │
       ▼
  Embed question (OpenAI)
       │
       ├────────────────┬────────────────┐
       ▼                ▼                │
 Vector search      Full-text search     │
 (pgvector cosine)  (Postgres tsvector)  │
       │                │                │
       └───────┬────────┘                │
               ▼                         │
       RRF fusion (pure Python,          │
       reciprocal rank fusion)           │
               │                         │
               ▼                         │
  Permission filter (role-based:         │
  SENSITIVE docs excluded unless admin) ─┘
               │
               ▼
      Context assembly
               │
               ▼
      gpt-4o-mini (OpenAI)
               │
               ▼
     Answer + citations
     (emits QUERY_EXECUTED audit event)
```

No reranking model, no separate retrieval service — fusion and permission filtering are in-process Python.

---

## Auth & Access Control

- Server-side session: `kg_session` cookie (HttpOnly, Secure, SameSite=Strict), validated against a Postgres `Session` row on every authenticated request — no JWT, no SSO.
- Role governs access, not ownership: `admin` | `user`. Non-admins never see `SENSITIVE` documents or their chunks, in any list/read/query endpoint.
- Per-email brute-force lockout (5 failed attempts → 15 min Redis lock) plus per-IP rate limiting (slowapi + Redis) on `/login`, `/register`, `/query`.

---

## Reliability Mechanisms

- **Poller + reaper** — recovers from Redis outages and worker crashes without losing jobs (see Document Processing above).
- **Worker retry classification** — transient errors (timeouts, `openai.RateLimitError`) retry with backoff up to `MAX_TRIES`; permanent errors (`ValueError`, `openai.AuthenticationError`, `openai.BadRequestError`) fail immediately.
- **Duplicate detection** — content hash unique constraint blocks re-uploading an identical file; version-number unique constraint + retry-with-increment handles concurrent version uploads.
- **Connection pool** — `pool_size=30, max_overflow=20` per Uvicorn worker, `pool_pre_ping=True`, `pool_recycle=1800`.

---

## Observability

- `structlog` — JSON logs in production, pretty-printed in dev. Request logging middleware attaches `request_id`, method, path, status, `duration_ms` to every request.
- LLM calls logged with model, token counts, `duration_ms`, estimated cost.
- Worker logs `job_start`/`job_complete`/`job_failure` with `duration_ms`, chunk count, attempt number. Poller logs queue depth.
- No metrics/dashboard platform (Prometheus, Grafana, Datadog) — logs only.

---

## Frontend Error Handling

- TanStack Query (`useQuery`/`useMutation`) owns all server state — no manual fetch/loading/error `useState`.
- 401 handled globally (`QueryProvider`'s `QueryCache`/`MutationCache` `onError`) → redirect to `/login`. Every other error (403/404/409/413/415/422/429/503/network) shown inline via `ErrorAlert`, next to the action that failed.
- `not-found.tsx` for unmatched routes; nested `error.tsx` boundaries (`(protected)` + root) for render crashes.

---

## Infrastructure

```
docker-compose.yml
├── postgres   (pgvector/pgvector:pg16, max_connections=200)
├── redis      (redis:7-alpine — job queue + rate-limit counters)
├── minio      (file storage, bucket auto-created on start)
├── backend    (FastAPI, uvicorn --workers 2)
├── worker     (same image, `arq app.workers.main.WorkerSettings`, max_jobs=5)
└── frontend   (Next.js, npm run dev / standalone build)
```

No Kubernetes, no managed cloud services, no CDN, no auto-scaling. Single `docker compose up -d` brings up the full stack.
