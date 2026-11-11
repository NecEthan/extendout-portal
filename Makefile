.PHONY: help \
        dev dev-build dev-infra dev-down audit-log \
        test-backend test-frontend \
        prod prod-build prod-down audit-prod

# ─── Dev ─────────────────────────────────────────────────────────────────────
# Full stack (backend + worker + frontend) with hot-reload source mounts.
# OPENAI_API_KEY must be set in .env.dev

dev:
	docker compose --env-file .env.dev up

dev-build:
	docker compose --env-file .env.dev up --build

# Infra only — use when running backend/frontend locally outside Docker
dev-infra:
	docker compose --env-file .env.dev up -d postgres redis minio minio-init

dev-down:
	docker compose --env-file .env.dev down

# Follow the local audit log, one readable line per request:
#   10:37:10  Test Admin (admin)  GET /team  200 success  project=7  {"title":"..."}
AUDIT_FORMAT = "\(.created_at[11:19])  \(.actor_name // .actor_email // "anonymous")\(if .actor_role then " (\(.actor_role))" else "" end)  \(.method) \(.route)  \(.status_code) \(.outcome)\(if .project_id then "  project=\(.project_id)" else "" end)\(if .details != {} then "  \(.details|tojson)" else "" end)"

audit-log:
	docker compose exec -T backend tail -n 50 -f /tmp/extendout-portal-audit.log | jq --unbuffered -r '$(AUDIT_FORMAT)'

# ─── Test ─────────────────────────────────────────────────────────────────────
# Backend tests use the local postgres from `make dev-infra` (port 5434).

# Run backend integration tests against the local DB
test-backend:
	cd backend && uv run pytest tests/ -v

# Run frontend unit tests
test-frontend:
	cd frontend && npm test -- --watchAll=false --ci

# ─── Prod ─────────────────────────────────────────────────────────────────────
# Full stack, no source mounts, production frontend build.
# Requires .env.prod with real SECRET_KEY and OPENAI_API_KEY.
# Ports: backend 8002, frontend 3002, postgres 5436

prod:
	docker compose -f docker-compose.prod.yml --env-file .env.prod up

prod-build:
	docker compose -f docker-compose.prod.yml --env-file .env.prod up --build

prod-down:
	docker compose -f docker-compose.prod.yml --env-file .env.prod down

# Prod audit entries, newest first. Runs psql inside the prod postgres
# container (no open DB port needed).
#   make audit-prod                  latest 50 (N=200 for more)
#   make audit-prod SINCE="1 day"    everything in the last 24 hours ("7 days", "1 month", "2 hours")
#   make audit-prod DAY=2026-11-10   everything on that day
#   make audit-prod MONTH=2026-10    everything in that calendar month
N ?= 50
AUDIT_WHERE = $(if $(SINCE),WHERE created_at > now() - interval '$(SINCE)',$(if $(DAY),WHERE created_at >= date '$(DAY)' AND created_at < date '$(DAY)' + 1,$(if $(MONTH),WHERE created_at >= date '$(MONTH)-01' AND created_at < date '$(MONTH)-01' + interval '1 month',)))
AUDIT_LIMIT = $(if $(or $(SINCE),$(DAY),$(MONTH)),ALL,$(N))
AUDIT_SQL = SELECT to_char(created_at, 'DD Mon HH24:MI:SS') AS at, \
  coalesce(actor_name, actor_email, 'anonymous') \
    || coalesce(' (' || actor_role || ')', '') AS who, \
  method || ' ' || route AS request, status_code || ' ' || outcome AS result, \
  coalesce(project_id::text, '') AS project, \
  CASE WHEN details = '{}'::jsonb THEN '' ELSE details::text END AS details, \
  coalesce(ip_address, '') AS ip \
  FROM audit_events $(AUDIT_WHERE) ORDER BY created_at DESC LIMIT $(AUDIT_LIMIT)

audit-prod:
	docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres \
	  psql -U postgres -d knowledgeguard_prod -P pager=off -c "$(AUDIT_SQL)"

# ─── Help ─────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "Dev   (ports 8000/3000/5434):  make dev | make dev-infra | make dev-down | make audit-log"
	@echo "Test:                         make test-backend | make test-frontend"
	@echo "Prod  (ports 8002/3002/5436):  make prod | make prod-build | make prod-down | make audit-prod"
	@echo ""
	@echo "First time: copy OPENAI_API_KEY into .env.dev and .env.prod"
	@echo ""
