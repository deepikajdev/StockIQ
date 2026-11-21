from datetime import datetime
from decimal import Decimal
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field

T = TypeVar("T")
Money = Decimal


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


# ---- auth
class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class UserOut(ORM):
    id: int
    email: str
    full_name: str
    role: str
    business_id: int


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---- categories
class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class CategoryOut(ORM):
    id: int
    name: str


# ---- products
class ProductIn(BaseModel):
    sku: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    category_id: int | None = None
    unit: str = Field(default="pcs", min_length=1, max_length=20)
    selling_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    cost_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    reorder_point: int = Field(default=0, ge=0)
    safety_stock: int = Field(default=0, ge=0)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    category_id: int | None = None
    unit: str | None = Field(default=None, min_length=1, max_length=20)
    selling_price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    cost_price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    reorder_point: int | None = Field(default=None, ge=0)
    safety_stock: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class ProductOut(ORM):
    id: int
    sku: str
    name: str
    category_id: int | None
    category_name: str | None = None
    unit: str
    selling_price: Decimal
    cost_price: Decimal
    reorder_point: int
    safety_stock: int
    is_active: bool
    stock_on_hand: int = 0


# ---- suppliers
class SupplierIn(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    contact_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None


class SupplierUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    contact_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    is_active: bool | None = None


class SupplierOut(ORM):
    id: int
    name: str
    contact_name: str | None
    email: str | None
    phone: str | None
    address: str | None
    is_active: bool


class ProductSupplierIn(BaseModel):
    supplier_id: int
    unit_cost: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    lead_time_days: int | None = Field(default=None, ge=0)
    min_order_qty: int | None = Field(default=None, gt=0)
    is_preferred: bool = False


class ProductSupplierOut(ORM):
    id: int
    product_id: int
    supplier_id: int
    supplier_name: str
    unit_cost: Decimal | None
    lead_time_days: int | None
    min_order_qty: int | None
    is_preferred: bool


# ---- purchases
class PurchaseItemIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
    unit_cost: Decimal = Field(ge=0, max_digits=12, decimal_places=2)


class PurchaseIn(BaseModel):
    supplier_id: int
    items: list[PurchaseItemIn] = Field(min_length=1)
    notes: str | None = None
    receive_now: bool = False


class PurchaseItemOut(ORM):
    id: int
    product_id: int
    sku: str
    product_name: str
    quantity: int
    unit_cost: Decimal


class PurchaseOut(ORM):
    id: int
    supplier_id: int
    supplier_name: str
    status: str
    order_date: datetime
    received_at: datetime | None
    total_cost: Decimal
    notes: str | None
    items: list[PurchaseItemOut]


# ---- sales
class SaleItemIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class SaleIn(BaseModel):
    items: list[SaleItemIn] = Field(min_length=1)
    customer_name: str | None = Field(default=None, max_length=120)


class SaleItemOut(ORM):
    id: int
    product_id: int
    sku: str
    product_name: str
    quantity: int
    unit_price: Decimal


class SaleOut(ORM):
    id: int
    status: str
    sold_at: datetime
    customer_name: str | None
    total_amount: Decimal
    items: list[SaleItemOut]


# ---- inventory
AdjustReason = Literal["opening_balance", "damaged", "lost", "found", "correction", "other"]


class AdjustmentIn(BaseModel):
    product_id: int
    quantity_change: int
    reason: AdjustReason
    note: str | None = Field(default=None, max_length=200)


class InventoryOut(BaseModel):
    product_id: int
    sku: str
    name: str
    category_name: str | None
    unit: str
    warehouse_id: int
    warehouse_name: str
    quantity: int
    cost_price: Decimal
    stock_value: Decimal
    reorder_point: int
    is_active: bool


class MovementOut(BaseModel):
    id: int
    created_at: datetime
    product_id: int
    sku: str
    product_name: str
    movement_type: str
    quantity_change: int
    quantity_before: int
    quantity_after: int
    reference_type: str | None
    reference_id: int | None
    reason: str | None
    user_name: str

# ---- intelligence (read-only analytics)
StockoutRisk = Literal["critical", "high", "medium", "low", "none"]
RiskCategory = Literal["critical", "dead_stock", "slow_moving", "excess", "low_stock", "healthy"]


class DemandStatsOut(BaseModel):
    total_units_sold: int
    observed_sale_days: int
    window_days: int
    first_sale_date: str | None
    last_sale_date: str | None
    days_since_last_sale: int | None
    avg_daily_demand: float
    weighted_daily_demand: float
    insufficient_history: bool


class DemandForecastOut(BaseModel):
    daily_demand: float
    forecast_7d_units: float
    forecast_30d_units: float
    method: str
    is_machine_learning: bool
    uses_category_fallback: bool
    data_days_available: int
    insufficient_history: bool


class StockoutPredictionOut(BaseModel):
    days_until_stockout: float | None
    stockout_risk: StockoutRisk
    out_of_stock: bool
    current_stock: int
    avg_daily_demand: float
    lead_time_days: int
    lead_time_is_assumed: bool
    will_stockout_before_reorder: bool


class ReorderSupplierOut(BaseModel):
    supplier_id: int
    supplier_name: str
    lead_time_days: int
    min_order_qty: int
    unit_cost: Decimal | None


class ReorderExplanationOut(BaseModel):
    """Typed, auditable inputs behind a reorder suggestion (no ML claims)."""

    lookback_days: int
    window_start: str | None
    window_end: str | None
    units_sold: int
    avg_daily_sales: float
    demand_basis: float
    current_stock: int
    lead_time_days: int
    lead_time_source: str
    lead_time_is_assumed: bool
    safety_stock: int
    review_period_days: int
    reorder_point_calculated: int
    reorder_point_manual: int
    effective_reorder_point: int
    target_stock: int
    suggested_qty: int
    adjusted_for_moq: bool
    min_order_qty: int
    formula_reorder_point: str
    formula_target_stock: str
    formula_suggested_qty: str
    disclaimer: str


class ReorderRecommendationOut(BaseModel):
    needs_reorder: bool
    configured_reorder_point: int
    calculated_reorder_point: int
    effective_reorder_point: int
    current_stock: int
    target_stock: float
    raw_qty_needed: float
    min_order_qty: int
    reorder_qty: int
    unit_cost: Decimal | None
    estimated_order_cost: Decimal | None
    supplier: ReorderSupplierOut | None
    explanation: list[str]
    explanation_details: ReorderExplanationOut
    formula: str


class RiskScoreOut(BaseModel):
    risk_score: int
    risk_category: RiskCategory
    days_of_cover: float | None
    reasons: list[str]
    recommended_action: str


class ProductIntelligenceOut(BaseModel):
    product_id: int
    sku: str
    name: str
    category_name: str | None
    unit: str
    is_active: bool
    current_stock: int
    cost_price: Decimal
    demand_stats: DemandStatsOut
    forecast: DemandForecastOut
    stockout_prediction: StockoutPredictionOut
    reorder_recommendation: ReorderRecommendationOut
    risk: RiskScoreOut


class IntelligenceCountsOut(BaseModel):
    total_products: int
    needs_reorder: int
    critical: int
    low_stock: int
    dead_stock: int
    slow_moving: int
    excess: int
    healthy: int


class IntelligenceSummaryOut(BaseModel):
    generated_at: datetime
    window_days: int
    algorithm: str
    risk_model_version: str
    counts: IntelligenceCountsOut
    items: list[ProductIntelligenceOut]


class ReorderQueueOut(BaseModel):
    generated_at: datetime
    window_days: int
    algorithm: str
    total: int
    items: list[ProductIntelligenceOut]


class RiskReportOut(BaseModel):
    generated_at: datetime
    window_days: int
    risk_model_version: str
    counts: IntelligenceCountsOut
    items: list[ProductIntelligenceOut]


class ForecastPointOut(BaseModel):
    date: str
    units: float
    is_forecast: bool


class ForecastSeriesOut(BaseModel):
    product_id: int
    sku: str
    name: str
    method: str
    daily_demand: float
    history_days: int
    forecast_days: int
    points: list[ForecastPointOut]


class EvaluationMetricsOut(BaseModel):
    mae_model: float
    mae_naive: float
    wape_model: float | None
    wape_naive: float | None
    model_beats_naive_baseline: bool | None


class EvaluationWindowOut(BaseModel):
    start: str
    end: str
    days: int


class EvaluationProductOut(BaseModel):
    product_id: int
    sku: str
    name: str
    train_avg_daily: float
    model_daily: float
    actual_daily: float
    ae_model: float
    ae_naive: float
    better_model: Literal["model", "naive", "tie"]


class ForecastEvaluationOut(BaseModel):
    algorithm: str
    train_window: EvaluationWindowOut
    test_window: EvaluationWindowOut
    products_evaluated: int
    metrics: EvaluationMetricsOut
    data_limitations: list[str]
    per_product: list[EvaluationProductOut]
