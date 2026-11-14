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
    storage_bucket: str = "extendout-portal-bucket"
    # Railway Buckets: REGION is "auto" and new buckets need the bucket name
    # in the host name (virtual-hosted style). Local MinIO needs neither.
    storage_region: str = ""
    storage_virtual_style: bool = False

    # Nightly bucket backup (app/backup_bucket.py), run as a Railway cron
    # service. In production the backup is a second Railway bucket; any S3
    # bucket works (e.g. Cloudflare R2, to survive losing the Railway account).
    backup_storage_endpoint: str = ""
    backup_storage_access_key: str = ""
    backup_storage_secret_key: str = ""
    backup_storage_bucket: str = ""
    backup_storage_region: str = ""
    backup_storage_virtual_style: bool = False
    # A file deleted in the app stays in the backup this many days, so a
    # mistaken delete can be undone; after that it's removed (UK GDPR:
    # deleted client data shouldn't be kept indefinitely).
    backup_keep_deleted_days: int = 30

    redis_url: str = "redis://localhost:6379/0"

    openai_api_key: str = ""
    chat_model: str = "gpt-4o-mini"

    session_cookie_name: str = "eo_session"
    # Login sessions last 400 days (Chrome's maximum cookie lifetime).
    session_max_age_days: int = 400

    # Login codes. "outbox" (local/CI) logs the code and keeps it in Redis for
    # GET /dev/outbox/{email}; production must use "resend" (checked at startup).
    email_backend: Literal["outbox", "resend"] = "outbox"
    resend_api_key: str = ""
    # Sender shown in the inbox; the address must be on the domain verified in
    # Resend, e.g. "ExtendOut Portal <portal@mail.extendout.co.uk>".
    email_from: str = ""
    login_code_ttl_seconds: int = 600
    # Wrong tries on one code before that code is cancelled (request a new one).
    login_code_cancel_after_wrong_tries: int = 5
    login_code_requests_per_window: int = 3  # codes per email per window
    login_code_window_seconds: int = 900

    # Full drawing sets and scanned calc packs can be 50-100 MB.
    max_upload_size_mb: int = 100
    max_photo_size_mb: int = 20
    # Width x height cap, checked before decoding, so a tiny "decompression
    # bomb" file can't expand into gigabytes of memory. 100 MP covers phone
    # cameras (typically 12-50 MP).
    max_photo_pixels: int = 100_000_000

    # LLM pricing for cost estimation per query (USD per 1M tokens).
    # Defaults match gpt-4o-mini; override via environment variables.
    llm_input_cost_per_1m_tokens: float = 0.150
    llm_output_cost_per_1m_tokens: float = 0.600

    # Per IP, across all emails, for requesting and for verifying login codes.
    # Kept above login_lockout_after_wrong_codes so the per-email lock (and its
    # message) is reached before this limit.
    login_rate_limit: str = "20/minute"
    # Wrong codes for an email (across any codes) before that email is locked
    # for login_lockout_seconds: no codes sent or accepted.
    login_lockout_after_wrong_codes: int = 5
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
