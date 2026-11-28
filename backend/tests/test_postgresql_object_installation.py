"""Unit checks for PostgreSQL object installation without a live database."""

from types import SimpleNamespace

from app.postgresql_objects import (
    POSTGRESQL_OBJECT_NAMES,
    POSTGRESQL_OBJECT_STATEMENTS,
    POSTGRESQL_ROUTINE_STATEMENTS,
    POSTGRESQL_TRIGGER_STATEMENTS,
    POSTGRESQL_VIEW_STATEMENTS,
    install_postgresql_objects,
)


class _FakeConnection:
    def __init__(self, executed: list[str]):
        self.executed = executed

    def exec_driver_sql(self, statement: str) -> None:
        self.executed.append(statement)


class _FakeTransaction:
    def __init__(self, connection: _FakeConnection):
        self.connection = connection

    def __enter__(self) -> _FakeConnection:
        return self.connection

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False


class _FakeEngine:
    def __init__(self, dialect_name: str):
        self.dialect = SimpleNamespace(name=dialect_name)
        self.executed: list[str] = []
        self.begin_calls = 0

    def begin(self) -> _FakeTransaction:
        self.begin_calls += 1
        return _FakeTransaction(_FakeConnection(self.executed))


def test_object_registry_has_the_expected_groups():
    assert len(POSTGRESQL_VIEW_STATEMENTS) == 4
    assert len(POSTGRESQL_ROUTINE_STATEMENTS) == 1
    assert len(POSTGRESQL_TRIGGER_STATEMENTS) == 7
    assert len(POSTGRESQL_OBJECT_NAMES) == len(POSTGRESQL_OBJECT_STATEMENTS) == 12
    assert len(set(POSTGRESQL_OBJECT_NAMES)) == 12

    all_sql = "\n".join(POSTGRESQL_OBJECT_STATEMENTS)
    for name in POSTGRESQL_OBJECT_NAMES:
        assert name in all_sql, name


def test_installer_skips_non_postgresql_engines_without_opening_a_transaction():
    engine = _FakeEngine("mysql")

    assert install_postgresql_objects(engine) is False
    assert engine.begin_calls == 0
    assert engine.executed == []


def test_installer_runs_every_statement_once_in_dependency_order():
    engine = _FakeEngine("postgresql")

    assert install_postgresql_objects(engine) is True
    assert engine.begin_calls == 1
    assert engine.executed == list(POSTGRESQL_OBJECT_STATEMENTS)
