"""Bootstrap password handling tests."""

from types import SimpleNamespace

import pytest
from pydantic import SecretStr

from scripts import bootstrap


def test_development_bootstrap_keeps_demo_defaults(monkeypatch):
    monkeypatch.setattr(bootstrap, "settings", SimpleNamespace(is_production=False))
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)

    password = bootstrap._resolve_bootstrap_password("admin", "ADMIN_PASSWORD", None)

    assert password == "admin12345"


def test_production_bootstrap_requires_explicit_password(monkeypatch):
    monkeypatch.setattr(bootstrap, "settings", SimpleNamespace(is_production=True))
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)

    with pytest.raises(RuntimeError, match="must be set in production"):
        bootstrap._resolve_bootstrap_password("admin", "ADMIN_PASSWORD", None)


def test_production_bootstrap_rejects_demo_password(monkeypatch):
    monkeypatch.setattr(bootstrap, "settings", SimpleNamespace(is_production=True))

    with pytest.raises(RuntimeError, match="unsafe in production"):
        bootstrap._resolve_bootstrap_password(
            "staff", "STAFF_PASSWORD", SecretStr("staff12345")
        )


def test_production_bootstrap_accepts_strong_password(monkeypatch):
    monkeypatch.setattr(bootstrap, "settings", SimpleNamespace(is_production=True))
    strong = "Str0ng!Explicit-Bootstrap-Passphrase"

    assert (
        bootstrap._resolve_bootstrap_password(
            "admin", "ADMIN_PASSWORD", SecretStr(strong)
        )
        == strong
    )
