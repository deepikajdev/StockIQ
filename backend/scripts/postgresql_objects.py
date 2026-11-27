"""Backward-compatible import path for PostgreSQL object installation.

The canonical statements and installer now live in ``app.postgresql_objects``
so bootstrap code and verification tests share one definition.
"""

from app.postgresql_objects import (
    POSTGRESQL_OBJECT_NAMES,
    POSTGRESQL_OBJECT_STATEMENTS,
    POSTGRESQL_ROUTINE_STATEMENTS,
    POSTGRESQL_TRIGGER_STATEMENTS,
    POSTGRESQL_VIEW_STATEMENTS,
    install_postgresql_objects,
)

__all__ = [
    "POSTGRESQL_OBJECT_NAMES",
    "POSTGRESQL_OBJECT_STATEMENTS",
    "POSTGRESQL_ROUTINE_STATEMENTS",
    "POSTGRESQL_TRIGGER_STATEMENTS",
    "POSTGRESQL_VIEW_STATEMENTS",
    "install_postgresql_objects",
]
