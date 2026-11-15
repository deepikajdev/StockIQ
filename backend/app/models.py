"""Relational schema (3NF). Money = DECIMAL, quantities = INT, timestamps = naive UTC.

inventory = current balance; stock_movements = append-only ledger.
Every business-owned table carries business_id so multi-tenancy can be switched on later.
"""
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint, DateTime, ForeignKey, Index, Integer, JSON, Numeric, String,
    Text, UniqueConstraint, Boolean,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Business(Base):
    __tablename__ = "businesses"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class Role(Base):
    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)  # admin | staff


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    role: Mapped[Role] = relationship(lazy="joined")
    __table_args__ = (Index("ix_users_business", "business_id"),)


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    __table_args__ = (UniqueConstraint("business_id", "name", name="uq_category_name"),)


class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"))
    sku: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False, default="pcs")
    selling_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    cost_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    reorder_point: Mapped[int] = mapped_column(Integer, nullable=False, default=0)   # manual floor
    safety_stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    category: Mapped[Category | None] = relationship(lazy="joined")
    __table_args__ = (
        UniqueConstraint("business_id", "sku", name="uq_product_sku"),
        CheckConstraint("selling_price >= 0 AND cost_price >= 0", name="ck_product_prices"),
        CheckConstraint("reorder_point >= 0 AND safety_stock >= 0", name="ck_product_reorder"),
        Index("ix_products_business_active", "business_id", "is_active"),
        Index("ix_products_category", "category_id"),
    )


