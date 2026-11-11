import os
import tempfile
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.getenv("ENV_FILE", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    cors_origins: str = "http://localhost:3000"

    database_url: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/knowledgeguard"
    )

    storage_endpoint: str = "http://localhost:9000"
    storage_access_key: str = "minioadmin"
    storage_secret_key: str = "minioadmin"
    storage_bucket: str = "knowledgeguard"

    redis_url: str = "redis://localhost:6379/0"

    openai_api_key: str = ""
    chat_model: str = "gpt-4o-mini"

    session_cookie_name: str = "eo_session"
    session_max_age_hours: int = 24

    max_upload_size_mb: int = 50
    max_photo_size_mb: int = 20
    # Width x height cap, checked before decoding, so a tiny "decompression
    # bomb" file can't expand into gigabytes of memory. 100 MP covers phone
    # cameras (typically 12-50 MP).
    max_photo_pixels: int = 100_000_000

    # LLM pricing for cost estimation per query (USD per 1M tokens).
    # Defaults match gpt-4o-mini; override via environment variables.
    llm_input_cost_per_1m_tokens: float = 0.150
    llm_output_cost_per_1m_tokens: float = 0.600

    bcrypt_executor_workers: int = 50
    # Per IP, across all emails. Kept above login_max_attempts so the per-email
    # lock (and its message) is reached before this limit.
    login_rate_limit: str = "20/minute"
    login_max_attempts: int = 5
    login_lockout_seconds: int = 900
    query_rate_limit: str = "20/minute"  # per user
    upload_rate_limit: str = "30/minute"  # per user, documents + versions combined
    global_rate_limit: str = "300/minute"  # per session, backstop for all other routes
    worker_max_jobs: int = 5
    worker_rate_limit_retry_delay: int = 60
    openai_worker_max_retries: int = 4

    db_pool_size: int = 30
    db_max_overflow: int = 20
    db_pool_recycle: int = 1800

    # Set to true to skip real OpenAI calls (load testing / CI)
    mock_llm: bool = False

    audit_backend: Literal["file", "db"] = "db"
    audit_file_path: str = os.path.join(
        tempfile.gettempdir(), "extendout-portal-audit.log"
    )


settings = Settings()
