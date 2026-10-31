# MVP Architecture

---

## System Overview

```
┌─────────────────────────────────┐
│           Browser               │
│   Next.js (App Router, CSR)     │
└────────────────┬────────────────┘
                 │ HTTP / REST
                 ▼
┌─────────────────────────────────┐
│           FastAPI               │
│                                 │
│  Documents  │  Query  │  Auth   │
└──┬──────────┴────┬────┴────┬────┘
   │               │         │
   ▼               ▼         ▼
┌────────────┐ ┌──────────────────────────┐ ┌─────────┐
│ PostgreSQL │ │        Retrieval          │ │  Redis  │
│            │ │                          │ │         │
│ users      │ │  Permission Filter       │ │  job    │
│ documents  │ │  Version Filter          │ │  queue  │
│ versions   │ │  Vector Search(pgvector) │ └────┬────┘
│ chunks     │ │  Full-Text Search        │      │
│ sessions   │ │  RRF Fusion               │      ▼
└────────────┘ └──────────┬───────────────┘ ┌─────────┐
                          │                 │ ARQ     │
                ┌─────────▼──────────┐      │ Worker  │
                │      OpenAI        │      └─────────┘
                │       (LLM)        │
                └────────────────────┘

┌────────────┐
│   MinIO    │  ← raw file storage (PDFs, DOCX, etc.)
└────────────┘
```

No separate vector database, no reranking model, no Google Docs or other external connectors, no audit log, no evaluation framework, no knowledge-health dashboard — file upload + the pipeline below is the whole system.

---

## Document Upload and Processing

```
User uploads file
       │
       ▼
┌─────────────┐
│   FastAPI   │  ← validates request, saves metadata
└──────┬──────┘
       │
       ├──────────────────────┐
       ▼                      ▼
┌────────────┐         ┌────────────┐
│ PostgreSQL │         │   MinIO    │
│            │         │            │
│ document   │         │ raw file   │
│ version    │         │ stored     │
│ PROCESSING │         └────────────┘
└──────┬─────┘
       │
       ▼
┌─────────────┐
│    Redis    │  ← processing job queued
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────┐
│           Worker Process          │
│                                  │
│  1. Fetch file from MinIO        │
│  2. OCR (if scanned)             │
│  3. Extract text                 │
│  4. Split into chunks            │
│  5. Generate embeddings          │
│  6. Store chunks + embeddings    │
│  7. Update version → ACTIVE      │
└──────────────────────────────────┘
       │
       ▼
┌────────────┐
│ PostgreSQL │  ← chunks + embeddings stored, status updated
└────────────┘
```

---

## Query Flow

```
User submits question
       │
       ▼
┌─────────────┐
│   FastAPI   │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│   Authentication    │  ← verify user identity
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Permission Filter  │  ← remove docs user cannot access
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Version Filter     │  ← keep only ACTIVE versions
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Hybrid Retrieval   │
│                     │
│  Vector search      │  ← semantic similarity via pgvector
│  Full-text search   │  ← keyword match via PostgreSQL
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│     Ranking         │  ← merge and score results
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Context Assembly   │  ← build prompt with retrieved chunks
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│      OpenAI         │  ← generate answer
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Answer + Citations │  ← source, version, status returned
└─────────────────────┘
```

---

## Data Storage

```
PostgreSQL
├── users
├── documents
├── document_versions      ← versioned, one ACTIVE per document
├── document_chunks        ← text + pgvector embeddings
├── processing_jobs        ← async job state
└── sessions               ← server-side session auth

MinIO
└── raw files              ← original uploads, retrievable by version

Redis
└── processing queue       ← jobs waiting for workers
```

No `document_permissions` table (access is role + sensitivity, not per-document grants) and no `audit_events` table (built, then removed from the codebase).

---

## Infrastructure (Local / MVP)

```
Docker Compose
├── frontend (Next.js)
├── backend (FastAPI, uvicorn --workers 2)
├── worker (ARQ, max_jobs=5)
├── postgres (pgvector + full-text search)
├── minio (file storage)
└── redis (job queue + rate-limit counters)
```

All services run locally via Docker Compose. One command brings the full stack up.
