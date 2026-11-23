"""PostgreSQL/libpq TLS options embedded in SQLAlchemy URLs.

This module is intentionally separate from :mod:`app.tls`, which handles
MySQL/PyMySQL TLS options. Keeping the two dialects separate avoids leaking
MySQL-only keys into PostgreSQL URLs and vice versa.
"""

from __future__ import annotations

from sqlalchemy.engine import URL, make_url

POSTGRESQL_TLS_QUERY_KEYS = {
    "sslmode",
    "sslrootcert",
    "sslcert",
    "sslkey",
    "sslpassword",
    "sslcrl",
    "sslcrldir",
    "ssl_min_protocol_version",
    "ssl_max_protocol_version",
}

VERIFIED_POSTGRESQL_TLS_MODES = {"verify-ca", "verify-full"}
UNVERIFIED_POSTGRESQL_TLS_MODES = {"disable", "allow", "prefer", "require"}


def _query_value(value: object) -> str:
    """Normalize SQLAlchemy URL query values."""
    if isinstance(value, (tuple, list)):
        value = value[0] if value else ""
    return str(value)


def postgresql_tls_options(database_url: str | URL) -> dict[str, str]:
    """Return normalized PostgreSQL TLS query options from a database URL."""
    url = make_url(database_url)
    return {
        str(key).strip().lower(): _query_value(value)
        for key, value in url.query.items()
        if str(key).strip().lower() in POSTGRESQL_TLS_QUERY_KEYS
    }


def validate_postgresql_tls(url: URL) -> None:
    """Require certificate-verified TLS for managed production PostgreSQL."""
    options = postgresql_tls_options(url)
    mode = (options.get("sslmode") or "").strip().lower()

    if not mode:
        raise ValueError("DATABASE_URL must include sslmode for verified TLS in production")
    if mode in UNVERIFIED_POSTGRESQL_TLS_MODES:
        raise ValueError("DATABASE_URL uses an unverified TLS mode")
    if mode not in VERIFIED_POSTGRESQL_TLS_MODES:
        raise ValueError("DATABASE_URL uses an invalid TLS mode")

    root_cert = (options.get("sslrootcert") or "").strip()
    if not root_cert:
        raise ValueError(
            "DATABASE_URL must include sslrootcert for verified TLS in production"
        )

    cert = (options.get("sslcert") or "").strip()
    key = (options.get("sslkey") or "").strip()
    if bool(cert) != bool(key):
        raise ValueError("DATABASE_URL must include both sslcert and sslkey together")


def postgresql_connect_args(database_url: str | URL) -> dict[str, object]:
    """Translate PostgreSQL TLS URL options into libpq/psycopg arguments.

    These options are kept out of the engine URL so credentials and certificate
    paths are not logged with connection details. Values are normalized to the
    lowercase libpq names expected by psycopg.
    """
    options = postgresql_tls_options(database_url)
    connect_args: dict[str, object] = {}
    for key, value in options.items():
        cleaned = value.strip()
        if not cleaned:
            continue
        connect_args[key] = cleaned.lower() if key == "sslmode" else cleaned
    return connect_args
