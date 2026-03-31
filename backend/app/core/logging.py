"""
Structured logging configuration using structlog.
"""
import logging
import structlog
from app.core.config import settings


def setup_logging() -> None:
    # Convert the log level from settings (e.g., "INFO") to logging constant
    log_level = getattr(logging, settings.log_level.upper(), logging.DEBUG)

    # Basic logging config for stdlib
    logging.basicConfig(
        format="%(message)s",
        level=log_level,
    )

    # Configure structlog
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,  # now works with LoggerFactory
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer() if settings.debug else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),  # <-- fixed here
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.BoundLogger:
    return structlog.get_logger(name)