from sqlalchemy import create_engine
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings
from .postgres_tls import POSTGRESQL_TLS_QUERY_KEYS, postgresql_connect_args
from .tls import TLS_QUERY_KEYS, is_true, tls_query_options


def _tls_query_keys(backend: str) -> set[str]:
    """Return the TLS query keys understood by a database backend."""
    if backend in {"mysql", "mariadb"}:
        return TLS_QUERY_KEYS
    if backend == "postgresql":
        return POSTGRESQL_TLS_QUERY_KEYS
    return set()


def database_engine_url(database_url: str | URL):
    """Return a URL with TLS options moved out of the query string.

    MySQL and PostgreSQL use different TLS query keys; only the keys for the
    URL's dialect are removed. Keeping them out of the URL avoids logging them
    alongside connection details.
    """
    url = make_url(database_url)
    tls_keys = _tls_query_keys(url.get_backend_name())
    remaining_query = {
        key: value
        for key, value in url.query.items()
        if str(key).strip().lower() not in tls_keys
    }
    return url.set(query=remaining_query)


def database_connect_args(database_url: str | URL) -> dict[str, object]:
    """Translate URL TLS options into dialect-specific connection arguments.

    MySQL/PyMySQL and PostgreSQL/psycopg use different TLS options, so each
    dialect has its own translation path. Production validates these options
    at settings load time.
    """
    backend = make_url(database_url).get_backend_name()
    if backend == "postgresql":
        return postgresql_connect_args(database_url)
    return _mysql_database_connect_args(database_url)


def _mysql_database_connect_args(database_url: str | URL) -> dict[str, object]:
    """Translate MySQL TLS URL options into PyMySQL connection arguments.

    PyMySQL 2.x does not accept ``ssl_mode`` directly and does not expose
    ``ssl_capath`` as a top-level argument, so a single ``ssl`` context dict is
    built instead.
    """
    options = tls_query_options(database_url)

    if is_true(options.get("ssl_disabled")):
        return {"ssl_disabled": True}

    ssl_context: dict[str, object] = {}
    for query_key, ssl_key in (
        ("ssl_ca", "ca"),
        ("ssl_capath", "capath"),
        ("ssl_cert", "cert"),
        ("ssl_key", "key"),
        ("ssl_key_password", "password"),
        ("ssl_cipher", "cipher"),
    ):
        if options.get(query_key):
            ssl_context[ssl_key] = options[query_key]

    mode = (options.get("ssl_mode") or "").strip().lower()
    if mode == "disabled":
        return {"ssl_disabled": True}
    if mode == "verify_ca":
        ssl_context.update(verify_mode=True, check_hostname=False)
    elif mode == "verify_identity":
        ssl_context.update(verify_mode=True, check_hostname=True)
    elif mode == "required":
        ssl_context.update(verify_mode=False, check_hostname=False)
    # "preferred" needs no context: PyMySQL attempts TLS and falls back by default.

    if "ssl_verify_cert" in options:
        ssl_context["verify_mode"] = is_true(options["ssl_verify_cert"])
    if "ssl_verify_identity" in options:
        ssl_context["check_hostname"] = is_true(options["ssl_verify_identity"])

    if not ssl_context:
        return {}
    return {"ssl": ssl_context}


configured_url = settings.database_url_object

engine = create_engine(
    database_engine_url(configured_url),
    connect_args=database_connect_args(configured_url),
    pool_pre_ping=True,
    pool_recycle=1800,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """One session per request. Anything not committed is rolled back on close."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
