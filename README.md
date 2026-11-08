# ExtendOut Portal

The project workspace for **ExtendOut Design | Build** — extensions, loft conversions and renovations across Surrey and London.

Every job is a project. The office team, the site team and the homeowner share the project's documents in one place, and anyone on the project can ask a question in plain English and get an answer from the **current** version of the project's documents, with the source file and version cited.

## The problem

A single extension produces a lot of paperwork: architectural drawings, structural calculations, building-control approvals, specifications, quotes, change requests. Most of it gets revised several times during the job.

On site, that means:

1. Digging through emails and shared folders for the right drawing
2. Not knowing whether you're looking at the latest revision
3. Homeowners phoning the office for answers that are already written down somewhere
4. Mistakes when someone builds from a superseded drawing or calc

## What the portal does

- **One place per job.** Each project holds its documents and the people working on it. Builders and homeowners only see the projects they've been added to.
- **Version control built in.** Uploading a revised drawing or calc keeps the history, but only one version is ever current.
- **Ask, don't search.** *"What U-value is specified for the rooflights?"*, *"What size is the steel over the bifolds?"* — the answer comes from the project's current documents, with the document and version it came from.
- **Never out of date.** Search ignores superseded versions entirely, so answers always reflect the latest revision.

## Who uses it

| Role | Who | Access |
|---|---|---|
| Admin | ExtendOut office | All projects; creates and edits projects; manages the team and who's on each project |
| Builder | Site team and trades | Documents and search for their projects |
| Client | Homeowners | Documents and search for their own project |

## Documentation

- [Overview](docs/overview.md) — what the portal does, roles, features, what's real vs sample data
- [Architecture](docs/architecture.md) — system diagram, data model, upload and search flows
- [Requirements](docs/requirements.md) — detailed behaviour and the full API
- [Technical design](docs/technical-design.md) — how and why it's built this way
- [Technology choices](docs/technologies.md)
- [Engineering decisions](docs/engineering-decisions.md)

---

## Development

### Prerequisites

- Docker + Docker Compose
- Node.js 20
- Python 3.12 + [uv](https://docs.astral.sh/uv/)

### Run the app

```bash
docker compose up -d
```

Starts Postgres, Redis, MinIO, the backend, the worker and the frontend. The app is at http://localhost:3000.

After backend code changes, restart the API and worker (`docker compose restart backend worker`); the frontend reloads on its own.

### Local accounts

These exist only in a local development database:

| Email | Password | Role |
|---|---|---|
| test@gmail.com | password | Admin |
| person1@gmail.com – person4@gmail.com | password | Client |
| person5@gmail.com | password | Builder |

See [CLAUDE.md](CLAUDE.md) for commands (tests, migrations, linting).
