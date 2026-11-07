import asyncio
from contextlib import asynccontextmanager

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.limiter import limiter
from app.logging_config import configure_logging
from app.middleware import RequestLoggingMiddleware
from app.poller import run_poller
from app.routers import auth, documents, health, projects, query
from app.services import storage

# Configure structured logging before the app object is created so that
# any module-level loggers (e.g. in routers) pick up the configuration.
configure_logging(settings.app_env)


@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, storage.configure_bucket_lifecycle)
    pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    app.state.arq_pool = pool
    task = asyncio.create_task(run_poller(pool))
    yield
    task.cancel()
    await pool.aclose()


app = FastAPI(
    title="KnowledgeGuard API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.app_env == "development" else None,
    redoc_url="/redoc" if settings.app_env == "development" else None,
)

app.state.limiter = limiter


def rate_limit_exceeded_handler(
    request: Request, exc: RateLimitExceeded
) -> JSONResponse:
    # slowapi's default handler responds with {"error": ...}; every other
    # endpoint in this API responds with {"detail": ...} on failure, so the
    # frontend's error parsing (which reads body.detail) only works if we
    # normalize the shape here.
    detail = f"Rate limit exceeded: {exc.detail}"
    response = JSONResponse({"detail": detail}, status_code=429)
    limiter_state = request.app.state.limiter
    return limiter_state._inject_headers(response, request.state.view_rate_limit)


app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# RequestLoggingMiddleware must be added before CORSMiddleware so that
# request_id is bound before any early-exit CORS responses are logged.
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router, prefix="/auth")
app.include_router(documents.router, prefix="/documents")
app.include_router(query.router)
app.include_router(projects.router, prefix="/projects")
