"""Re-export activation logic from the shared service layer."""

from app.services.activation import DocumentDeletedError, activate_version

__all__ = ["activate_version", "DocumentDeletedError"]
