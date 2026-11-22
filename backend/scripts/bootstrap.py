"""Create tables + the single demo business, default warehouse, roles and two users.

Idempotent. Usage: python -m scripts.bootstrap   (run from backend/)

Passwords come from ``ADMIN_PASSWORD`` / ``STAFF_PASSWORD``.  Demo defaults are
kept for local development only; production requires explicit strong values.
"""
import logging
import os

from pydantic import SecretStr
from sqlalchemy import select

from app import models
from app.config import INSECURE_BOOTSTRAP_PASSWORDS, settings
from app.db import Base, SessionLocal, engine
from app.logging_config import configure_logging
from app.security import hash_password

configure_logging()
logger = logging.getLogger("stockiq.bootstrap")


def _resolve_bootstrap_password(
    role: str, env_name: str, configured: SecretStr | None
) -> str:
    """Return a password for a newly created bootstrap user, never logging it."""
    raw = configured.get_secret_value() if configured else None
    if not raw:
        raw = os.getenv(env_name)

    if settings.is_production:
        if not raw:
            raise RuntimeError(f"{env_name} must be set in production")
        if raw.strip().lower() in INSECURE_BOOTSTRAP_PASSWORDS:
            raise RuntimeError(f"{env_name} is unsafe in production")
        return raw

    return raw or f"{role}12345"


def run():
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        biz = db.scalar(select(models.Business))
        if not biz:
            biz = models.Business(name=os.getenv("BUSINESS_NAME", "Demo Stationery Shop"))
            db.add(biz); db.flush()
        roles = {}
        for name in ("admin", "staff"):
            r = db.scalar(select(models.Role).where(models.Role.name == name)) or models.Role(name=name)
            db.add(r); db.flush(); roles[name] = r
        if not db.scalar(select(models.Warehouse).where(models.Warehouse.business_id == biz.id)):
            db.add(models.Warehouse(business_id=biz.id, name="Main Store", is_default=True))
        for email, name, role, env_name, configured in (
            ("admin@stockiq.example.com", "Shop Owner", "admin", "ADMIN_PASSWORD", settings.admin_password),
            ("staff@stockiq.example.com", "Shop Staff", "staff", "STAFF_PASSWORD", settings.staff_password),
        ):
            if not db.scalar(select(models.User).where(models.User.email == email)):
                password = _resolve_bootstrap_password(role, env_name, configured)
                db.add(models.User(business_id=biz.id, role_id=roles[role].id, email=email, full_name=name,
                                   password_hash=hash_password(password)))
        db.commit()
    logger.info("bootstrap_complete", extra={"event": "bootstrap_complete"})


if __name__ == "__main__":
    run()
