"""Health endpoint tests: liveness and database readiness."""

from fastapi.testclient import TestClient

from app import main as main_module


class _AvailableSession:
    def __init__(self, calls):
        self.calls = calls

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, statement):
        self.calls.append(str(statement))
        return None


class _UnavailableSession:
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, statement):
        raise RuntimeError("internal database host detail must not be exposed")


def test_health_liveness(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_responses_include_security_headers(client):
    response = client.get("/health")

    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert "default-src 'none'" in response.headers["Content-Security-Policy"]
    # Development settings do not emit HSTS; production is covered by config tests/smoke check.
    assert "Strict-Transport-Security" not in response.headers


def test_readiness_reports_ready_when_database_available(client, monkeypatch):
    calls = []
    monkeypatch.setattr(main_module, "SessionLocal", lambda: _AvailableSession(calls))

    response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "database": "ok"}
    assert any("SELECT 1" in call for call in calls)


def test_readiness_reports_unavailable_without_leaking_details(client, monkeypatch):
    monkeypatch.setattr(main_module, "SessionLocal", _UnavailableSession)

    response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "database": "unavailable"}
    assert "internal database host detail" not in response.text


def test_unhandled_errors_return_generic_response():
    path = "/__test_unhandled_error"

    @main_module.app.get(path)
    def _boom():
        raise RuntimeError("super sensitive internal detail")

    try:
        local_client = TestClient(
            main_module.app, raise_server_exceptions=False
        )
        response = local_client.get(path)
    finally:
        main_module.app.router.routes[:] = [
            route
            for route in main_module.app.router.routes
            if getattr(route, "path", None) != path
        ]

    assert response.status_code == 500
    assert response.json() == {"detail": "Internal server error"}
    assert "super sensitive internal detail" not in response.text
    assert response.headers.get("X-Request-ID")
