"""Static ORM metadata checks shared by MySQL and PostgreSQL deployments.

These tests compile DDL in memory only. They catch model drift before a
database is touched and keep the dual-database schema contract explicit.
"""

from sqlalchemy.dialects import mysql, postgresql
from sqlalchemy.schema import CreateTable

from app.models import Base

EXPECTED_TABLES = {
    "audit_logs",
    "businesses",
    "categories",
    "inventory",
    "product_suppliers",
    "products",
    "purchase_items",
    "purchases",
    "roles",
    "sale_items",
    "sales",
    "stock_movements",
    "suppliers",
    "users",
    "warehouses",
}

DIRECT_TENANT_TABLES = {
    "users",
    "categories",
    "products",
    "suppliers",
    "warehouses",
    "purchases",
    "sales",
    "stock_movements",
    "audit_logs",
}


def _ddl(table_name: str, dialect) -> str:
    return str(CreateTable(Base.metadata.tables[table_name]).compile(dialect=dialect))


def test_metadata_contains_exactly_the_expected_tables():
    assert set(Base.metadata.tables) == EXPECTED_TABLES


def test_every_directly_tenant_owned_table_has_a_business_foreign_key():
    for table_name in DIRECT_TENANT_TABLES:
        table = Base.metadata.tables[table_name]
        business_fks = [
            fk for fk in table.foreign_keys
            if fk.target_fullname == "businesses.id"
        ]
        assert business_fks, f"{table_name} is missing a businesses.id foreign key"


def test_inventory_is_scoped_through_product_and_warehouse():
    inventory = Base.metadata.tables["inventory"]
    targets = {fk.target_fullname for fk in inventory.foreign_keys}

    assert {"products.id", "warehouses.id"} <= targets


def test_ddl_compiles_for_mysql_and_postgresql():
    for table_name in EXPECTED_TABLES:
        for dialect in (mysql.dialect(), postgresql.dialect()):
            ddl = _ddl(table_name, dialect)
            assert ddl.strip().startswith("CREATE TABLE"), (table_name, dialect.name)


def test_json_details_uses_native_types_on_both_dialects():
    mysql_ddl = _ddl("audit_logs", mysql.dialect())
    postgres_ddl = _ddl("audit_logs", postgresql.dialect())

    assert "details JSON," in mysql_ddl
    assert "details JSONB," in postgres_ddl
