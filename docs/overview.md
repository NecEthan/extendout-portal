# ExtendOut Portal — Overview

## What it is

The ExtendOut Portal is the project workspace for **ExtendOut Design | Build**, a design-and-build company delivering extensions, loft conversions and renovations across Surrey and London.

Every job is a **project**. Each project collects the people working on it, its documents (drawings, specifications, structural calculations, building-control paperwork, quotes), and an AI search that answers questions from those documents with a citation to the exact file and version.

## Who uses it

| Role | Who | What they can do |
|---|---|---|
| `admin` | ExtendOut office staff | Everything: create and edit projects, manage the team and roles, add people to projects, see every project and document |
| `builder` | Site team and trades | Work inside the projects they've been added to: upload, version and delete documents, search |
| `client` | Homeowners | Same document access as builders, limited to their own project(s) |

Access is decided by **role + project membership**. Builders and clients only ever see projects they've been added to; admins see everything. Who uploaded a document makes no difference.

## Core features

### Projects

- A project has a name, client and address. Project ids are plain auto-increment numbers (`/projects/101`).
- Only admins can create and edit projects.
- Each project page has tabs: **Overview**, **Site evidence**, **Documents**, **Search**, and (admins only) **Team**.

### Documents and versions

- Upload PDF, Word (.docx) or Excel (.xlsx) files (up to 50 MB) to a project.
- Uploading a new version of a document keeps the history:

```text
Rear Extension — Structural Calcs

v3  ACTIVE
v2  SUPERSEDED
v1  SUPERSEDED
```

- Exactly one version is `ACTIVE` at a time. An older version can be re-activated from the version history page.
- Processing (text extraction, OCR for scanned PDFs, chunking, embeddings) runs in the background; the UI shows each version's status while it processes.

### AI search

Ask a question on a project's **Search** tab:

```text
What U-value is specified for the rooflights?
```

The answer comes only from that project's documents, and only from their **current (`ACTIVE`) versions** — superseded versions are never searched. Every answer lists its sources: document title, version number, status and last-updated date.

### Team (admins only)

- **Team page** — every account, with role and projects. Admins change roles and add/remove people from projects.
- **Project Team tab** — the people on one project.

## What's real vs sample data

The portal is being built out in stages. These features use **real data** from the backend:

- Login, roles, sessions
- Projects (list, detail, create, edit)
- Documents, versions and processing status
- AI search
- Team and project membership

These screens currently show **sample data** (from `frontend/src/mocks/`) while the features are built:

- Project milestones and Site evidence (photos, inspections, issues)
- Client view: Overview and Progress Photos

## Example journey

1. **Set up** — an admin creates *"Surrey Rear Extension"* for client *Sarah & James Holloway* and adds the site lead (builder) and the homeowners (client) to it.
2. **Upload** — the site lead uploads *"Structural Calcs.pdf"*. It shows as `PROCESSING`, then `ACTIVE`.
3. **Ask** — the homeowner asks *"What size is the steel beam over the bifolds?"* and gets an answer citing *Structural Calcs v1*.
4. **Revise** — the engineer issues revised calcs; the site lead uploads them as a new version. v2 becomes `ACTIVE`, v1 becomes `SUPERSEDED`.
5. **Ask again** — the same question now answers from v2 only.
6. **Isolation** — a client on a different project can't see this project, its documents, or anything from them in search.

## What it optimises for

```text
Right project + right people + current version + traceable source
  = answers the site team and the homeowner can trust
```
