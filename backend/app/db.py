from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings
from .tls import TLS_QUERY_KEYS, is_true, tls_query_options


def database_engine_url(database_url: str):
    """Return a URL with TLS options moved out of the query string.

    Keeping TLS options in the URL would log them alongside connection details;
    passing them as ``connect_args`` is explicit and avoids duplicate options.
    """
    url = make_url(database_url)
    remaining_query = {
        key: value
        for key, value in url.query.items()
        if str(key).strip().lower() not in TLS_QUERY_KEYS
    }
    return url.set(query=remaining_query)


def database_connect_args(database_url: str) -> dict[str, object]:
    """Translate URL TLS options into PyMySQL-compatible connection arguments.

    PyMySQL 2.x does not accept ``ssl_mode`` directly and does not expose
    ``ssl_capath`` as a top-level argument, so a single ``ssl`` context dict is
    built instead. Production validates these options at settings load time.
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


engine = create_engine(
    database_engine_url(settings.database_url_value),
    connect_args=database_connect_args(settings.database_url_value),
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
