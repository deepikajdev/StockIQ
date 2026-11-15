"""Create tables + the single demo business, default warehouse, roles and two users.
Idempotent. Usage: python -m scripts.bootstrap   (run from backend/)
Passwords come from env (ADMIN_PASSWORD / STAFF_PASSWORD); defaults are demo-only."""
import os

from sqlalchemy import select

from app import models
from app.db import Base, SessionLocal, engine
from app.security import hash_password


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
        for email, name, role, env in (
            ("admin@stockiq.example.com", "Shop Owner", "admin", "ADMIN_PASSWORD"),
            ("staff@stockiq.example.com", "Shop Staff", "staff", "STAFF_PASSWORD"),
        ):
            if not db.scalar(select(models.User).where(models.User.email == email)):
                db.add(models.User(business_id=biz.id, role_id=roles[role].id, email=email, full_name=name,
                                   password_hash=hash_password(os.getenv(env, f"{role}12345"))))
        db.commit()
    print("bootstrap complete")


if __name__ == "__main__":
    run()
