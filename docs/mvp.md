# MVP

## Project Goal

Build a production style enterprise knowledge platform that demonstrates how AI systems can be made more reliable through strong software engineering, data governance, security, observability, and lifecycle management.

## User Story

1. User signs up and logs in
2. User uploads a document (PDF, DOCX, TXT, or Markdown)
3. System processes the document — extracts text, chunks, generates embeddings, indexes
4. User sees document appear in their document list with processing status
5. User asks a question in natural language via the AI search interface
6. System checks permissions, filters to current version, retrieves relevant chunks, generates answer
7. User receives an answer with a citation showing source document, version, and last updated date
8. User uploads an updated version of the document
9. System supersedes the old version and indexes the new one
10. The same question now returns an answer based on the new version
11. User deletes a document — system removes it from all indexes and search results

---

## Data Sources

The MVP supports:

1. File uploads
2. PDF
3. DOCX
4. TXT
5. Markdown

Connectors to external systems (Google Docs, SharePoint, etc.) are not built — file upload is the only ingestion path.

## Document Management

Users can:

1. Upload documents
2. View documents
3. Update documents (new version)
4. Delete documents
5. View metadata
6. View processing status
7. View document version history

## Versioning

Every document update creates a new immutable version.

Example:

```text
Annual Leave Policy

v3  ACTIVE
v2  SUPERSEDED
v1  SUPERSEDED
```

Only one version can be active at any time.

Normal AI queries retrieve the active version.

Historical queries can explicitly retrieve previous versions.

## AI Search

Users can ask questions such as:

```text
How many days of annual leave do employees receive?
```

The system:

```text
User Query
    ↓
Authentication
    ↓
Permission Check (role + sensitivity)
    ↓
Active Version Filtering
    ↓
Hybrid Retrieval (vector + full-text, fused with RRF)
    ↓
LLM
    ↓
Answer + Citations
```

## Citations

AI responses show:

1. Source document
2. Version
3. Document status
4. Last updated information

## Permissions

Access is role-based, not a per-document grant system: `admin` sees everything; `user` is excluded from documents marked `SENSITIVE`. Ownership has no effect on access.

Permission filtering happens before content is sent to the LLM.

## Deletion

Deleting a document removes it (and its MinIO object) so it can no longer be retrieved by AI queries.

## Document Lifecycle

```text
PROCESSING
    ↓
ACTIVE
    ↓
SUPERSEDED
    ↓
DELETED
```

Versions can also enter `FAILED` (processing error, retries exhausted) or `REVIEW_REQUIRED`.

---

# Example User Journey

### 1. Upload

A user uploads:

```text
Annual Leave Policy v1
```

### 2. Process

The system extracts the content, creates chunks, generates embeddings, and indexes the document.

### 3. Ask

The user asks:

```text
How many days annual leave do employees receive?
```

The AI answers using v1.

### 4. Update

The company uploads an updated policy.

```text
Annual Leave Policy v2
```

The system changes:

```text
v1  SUPERSEDED
v2  ACTIVE
```

### 5. Ask Again

The same question now retrieves v2.

### 6. Historical Query

The user asks the system to retrieve a previous version explicitly. It intentionally returns v1.

### 7. Delete

The policy is deleted. The document and its stored chunks/embeddings are removed.

### 8. Permission Test

An unauthorised user (non-admin, document marked `SENSITIVE`) attempts to ask about the document. It is excluded from their retrieval context.

---

# Document Processing Architecture

```text
Upload
   ↓
API (validate, upload to MinIO, insert DB rows in one transaction)
   ↓
Redis job queue (best-effort enqueue; poller retries if Redis is down)
   ↓
ARQ Worker
   ↓
Text Extraction (+ OCR for scanned PDFs)
   ↓
Chunking
   ↓
Embeddings (OpenAI)
   ↓
Store chunks + pgvector embeddings, update full-text index
   ↓
ACTIVE
```

Processing is asynchronous so large documents do not block API requests. Jobs use a deterministic id so re-enqueuing by the poller never creates duplicate work.

---

# AI Retrieval

```text
User Query
     ↓
Authentication
     ↓
Permission Filtering (role + sensitivity)
     ↓
Active Version Filtering
     ↓
Hybrid Retrieval (pgvector cosine + Postgres full-text)
     ↓
RRF Fusion
     ↓
Context Construction
     ↓
LLM
     ↓
Answer + Citations
```

---

# Architecture

```text
┌──────────────────┐
│   Next.js (CSR)   │
└────────┬──────────┘
         │
         ▼
┌──────────────────┐
│    FastAPI        │
└────────┬──────────┘
         │
 ┌───────┼──────────────┐
 ▼       ▼               ▼
Documents  Query         Auth
 │          │
 ▼          ▼
PostgreSQL  (vector search + full-text search, same DB)
 │
 ▼
LLM (OpenAI)
```

Document processing runs asynchronously:

```text
API
 ↓
Redis queue
 ↓
ARQ Worker
 ↓
Extraction
 ↓
Chunking
 ↓
Embeddings
 ↓
Indexing
```

---

# Data Model

Core entities (PostgreSQL):

```text
users
documents
document_versions
document_chunks        -- content + pgvector embedding
processing_jobs
sessions                -- server-side session auth
```

There is no `document_permissions` table — access is role + sensitivity based, not per-document grants. There is no `audit_events` table — audit logging was built and later removed from the codebase.

Example document:

```text
documents
    id
    title
    owner_id
    source_type     -- "upload" (only value in use)
    sensitivity      -- STANDARD | SENSITIVE
    created_at
```

Example version:

```text
document_versions
    id
    document_id
    version_number
    status
    content_hash
    created_at
    created_by
```

Example chunk:

```text
document_chunks
    id
    document_version_id
    content
    embedding
```

---

# Core API

```text
POST   /documents
GET    /documents
GET    /documents/:id
PATCH  /documents/:id
DELETE /documents/:id

POST   /documents/:id/versions
GET    /documents/:id/versions
GET    /documents/:id/versions/:version_id
PATCH  /documents/:id/versions/:version_id/activate

POST   /query
```

---

# UI

## AI Search

```text
Ask your company knowledge

[ What is the annual leave policy? ]

Answer

Employees receive ...

Source
Annual Leave Policy

Version
v3 ACTIVE

Updated
14 September 2026
```

## Documents

```text
Name                  Status

Annual Leave Policy   ACTIVE
Employee Handbook     ACTIVE
```

## Version History

```text
Annual Leave Policy

v3  ACTIVE
v2  SUPERSEDED
v1  SUPERSEDED
```

Users can activate a previous version from this screen.

## Observability (backend logs, no dashboard UI)

```text
API latency
Document processing latency
Queue depth
Processing failures
LLM latency
Token usage
Cost per query
```

Exposed via structured (`structlog`) logs only — there is no dashboard, metrics UI, audit log viewer, or knowledge-health screen in the product.

# Success Criteria

The MVP demonstrates:

```text
Active version retrieval works correctly

Superseded versions are excluded from normal queries

Historical versions can be intentionally retrieved

Deleted documents cannot be retrieved

Unauthorised users cannot retrieve restricted content

Every AI answer has traceable sources

Document processing failures are visible

Duplicate processing is handled safely
```

The system optimises for:

```text
Correct information
+
Correct version
+
Correct permissions
+
Traceable source
=
Trustworthy enterprise AI
```
