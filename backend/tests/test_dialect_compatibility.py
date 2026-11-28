"""Static compatibility checks for MySQL and PostgreSQL URL handling.

These tests exercise the URL/connect-argument helpers without opening a
database connection, so they never touch the local MySQL database or any
remote server.
"""

from sqlalchemy.engine import make_url

from app.db import database_connect_args, database_engine_url

MYSQL_TLS_URL = (
    "mysql+pymysql://app:Str0ng!Pass@db.example.com:3306/stockiq"
    "?ssl_ca=/etc/ssl/ca.pem&ssl_mode=VERIFY_IDENTITY&application_name=stockiq"
)
POSTGRESQL_TLS_URL = (
    "postgresql+psycopg://app:Str0ng!Pass@db.example.com:5432/stockiq"
    "?SSLMODE=VERIFY-FULL&SSLROOTCERT=/etc/ssl/ca.pem&application_name=stockiq"
)


def test_non_tls_query_parameters_survive_for_both_dialects():
    for raw in (MYSQL_TLS_URL, POSTGRESQL_TLS_URL):
        original = make_url(raw)
        engine_url = database_engine_url(raw)

        assert engine_url.query["application_name"] == "stockiq"
        assert engine_url.password == original.password
        assert engine_url.host == original.host


def test_cross_dialect_tls_options_are_not_consumed():
    mysql_with_postgres_tls = (
        "mysql+pymysql://app:Str0ng!Pass@db.example.com:3306/stockiq"
        "?sslmode=verify-full&sslrootcert=/etc/ssl/ca.pem"
    )
    assert database_connect_args(mysql_with_postgres_tls) == {}
    mysql_url = database_engine_url(mysql_with_postgres_tls)
    assert mysql_url.query["sslmode"] == "verify-full"
    assert mysql_url.query["sslrootcert"] == "/etc/ssl/ca.pem"

    postgres_with_mysql_tls = (
        "postgresql+psycopg://app:Str0ng!Pass@db.example.com:5432/stockiq"
        "?ssl_ca=/etc/ssl/ca.pem&ssl_mode=VERIFY_IDENTITY"
    )
    assert database_connect_args(postgres_with_mysql_tls) == {}
    postgres_url = database_engine_url(postgres_with_mysql_tls)
    assert postgres_url.query["ssl_ca"] == "/etc/ssl/ca.pem"
    assert postgres_url.query["ssl_mode"] == "VERIFY_IDENTITY"


def test_unsupported_dialect_is_passed_through_without_connect_args():
    raw = "sqlite:///stockiq.db"

    assert str(database_engine_url(raw)) == raw
    assert database_connect_args(raw) == {}
