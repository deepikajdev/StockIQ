"""Shared parsing of MySQL TLS options embedded in SQLAlchemy URLs.

TLS options are accepted as lowercase or uppercase query keys, normalized once,
then consumed by both production validation and engine construction.
"""

from __future__ import annotations

from sqlalchemy.engine import URL, make_url

TLS_QUERY_KEYS = {
    "ssl_ca",
    "ssl_capath",
    "ssl_cert",
    "ssl_cipher",
    "ssl_disabled",
    "ssl_key",
    "ssl_key_password",
    "ssl_mode",
    "ssl_verify_cert",
    "ssl_verify_identity",
}
BOOLEAN_TLS_KEYS = {"ssl_disabled", "ssl_verify_cert", "ssl_verify_identity"}
TLS_TRUE_VALUES = {"1", "true", "yes", "on"}
TLS_FALSE_VALUES = {"0", "false", "no", "off"}
VERIFIED_TLS_MODES = {"verify_ca", "verify_identity"}
UNVERIFIED_TLS_MODES = {"disabled", "preferred", "required"}


def _query_value(value: object) -> str:
    """Normalize SQLAlchemy URL query values."""
    if isinstance(value, (tuple, list)):
        value = value[0] if value else ""
    return str(value)


def tls_query_options(database_url: str | URL) -> dict[str, str]:
    """Return normalized TLS query options from a database URL."""
    url = make_url(database_url)
    return {
        str(key).strip().lower(): _query_value(value)
        for key, value in url.query.items()
        if str(key).strip().lower() in TLS_QUERY_KEYS
    }


def is_true(value: str | None) -> bool:
    return bool(value) and value.strip().lower() in TLS_TRUE_VALUES
