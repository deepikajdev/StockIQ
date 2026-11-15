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


class Supplier(Base):
    __tablename__ = "suppliers"
    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    contact_name: Mapped[str | None] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(40))
    address: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    __table_args__ = (
        UniqueConstraint("business_id", "name", name="uq_supplier_name"),
        Index("ix_suppliers_business", "business_id"),
    )


class ProductSupplier(Base):
    __tablename__ = "product_suppliers"
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), nullable=False)
    unit_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))        # unknown allowed
    lead_time_days: Mapped[int | None] = mapped_column(Integer)              # unknown allowed
    min_order_qty: Mapped[int | None] = mapped_column(Integer)
    is_preferred: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    supplier: Mapped[Supplier] = relationship(lazy="joined")
    __table_args__ = (
        UniqueConstraint("product_id", "supplier_id", name="uq_product_supplier"),
        CheckConstraint("lead_time_days IS NULL OR lead_time_days >= 0", name="ck_ps_lead"),
        CheckConstraint("min_order_qty IS NULL OR min_order_qty > 0", name="ck_ps_moq"),
        Index("ix_ps_supplier", "supplier_id"),
    )


class Warehouse(Base):
    __tablename__ = "warehouses"
    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    __table_args__ = (UniqueConstraint("business_id", "name", name="uq_warehouse_name"),)


class Inventory(Base):
    __tablename__ = "inventory"
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    __table_args__ = (
        UniqueConstraint("product_id", "warehouse_id", name="uq_inventory_product_wh"),
        CheckConstraint("quantity >= 0", name="ck_inventory_non_negative"),
        Index("ix_inventory_warehouse", "warehouse_id"),
    )


class Purchase(Base):
    __tablename__ = "purchases"
    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), nullable=False)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")  # draft|received|cancelled
    order_date: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    received_at: Mapped[datetime | None] = mapped_column(DateTime)
    total_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    supplier: Mapped[Supplier] = relationship(lazy="joined")
    items: Mapped[list["PurchaseItem"]] = relationship(back_populates="purchase", cascade="all, delete-orphan", lazy="selectin")
    __table_args__ = (
        CheckConstraint("status IN ('draft','received','cancelled')", name="ck_purchase_status"),
        Index("ix_purchases_business_status", "business_id", "status"),
        Index("ix_purchases_supplier", "supplier_id"),
        Index("ix_purchases_date", "order_date"),
    )


class PurchaseItem(Base):
    __tablename__ = "purchase_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    purchase_id: Mapped[int] = mapped_column(ForeignKey("purchases.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    purchase: Mapped[Purchase] = relationship(back_populates="items")
    product: Mapped[Product] = relationship(lazy="joined")
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_pi_qty"),
        CheckConstraint("unit_cost >= 0", name="ck_pi_cost"),
        Index("ix_pi_purchase", "purchase_id"),
        Index("ix_pi_product", "product_id"),
    )


