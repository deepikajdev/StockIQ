// Domain & API Type Definitions matching FastAPI OpenAPI Contract

export type UserRole = 'admin' | 'staff';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  business_id: number;
}

export interface TokenOut {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface Category {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category_id: number | null;
  category_name?: string | null;
  unit: string;
  selling_price: string; // decimal string
  cost_price: string;    // decimal string
  reorder_point: number;
  safety_stock: number;
  is_active: boolean;
  stock_on_hand: number;
}

export interface ProductSupplier {
  id: number;
  product_id: number;
  supplier_id: number;
  supplier_name: string;
  unit_cost: string | null;
  lead_time_days: number | null;
  min_order_qty: number | null;
  is_preferred: boolean;
}

export interface Supplier {
  id: number;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  is_active: boolean;
}

export interface InventoryItem {
  product_id: number;
  sku: string;
  name: string;
  category_name: string | null;
  unit: string;
  warehouse_id: number;
  warehouse_name: string;
  quantity: number;
  cost_price: string;
  stock_value: string;
  reorder_point: number;
  is_active: boolean;
}

export type AdjustReason =
  | 'opening_balance'
  | 'damaged'
  | 'lost'
  | 'found'
  | 'correction'
  | 'other';

export interface StockAdjustmentIn {
  product_id: number;
  quantity_change: number;
  reason: AdjustReason;
  note?: string | null;
}

export interface MovementOut {
  id: number;
  created_at: string;
  product_id: number;
  sku: string;
  product_name: string;
  movement_type: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  reference_type: string | null;
  reference_id: number | null;
  reason: string | null;
  user_name: string;
}

export type PurchaseStatus = 'draft' | 'received' | 'cancelled';

export interface PurchaseItem {
  id: number;
  product_id: number;
  sku: string;
  product_name: string;
  quantity: number;
  unit_cost: string;
}

export interface Purchase {
  id: number;
  supplier_id: number;
  supplier_name: string;
  status: PurchaseStatus;
  order_date: string;
  received_at: string | null;
  total_cost: string;
  notes: string | null;
  items: PurchaseItem[];
}

export type SaleStatus = 'completed' | 'cancelled';

export interface SaleItem {
  id: number;
  product_id: number;
  sku: string;
  product_name: string;
  quantity: number;
  unit_price: string;
}

export interface Sale {
  id: number;
  status: SaleStatus;
  sold_at: string;
  customer_name: string | null;
  total_amount: string;
  items: SaleItem[];
}

// 409 Insufficient Stock Error
export interface InsufficientStockDetail {
  code: 'insufficient_stock';
  message: string;
  product_id: number;
  available: number;
  requested: number;
}

// ---- Phase 3: Intelligence Engine (read-only analytics) -------------------

export type StockoutRisk = 'critical' | 'high' | 'medium' | 'low' | 'none';
export type RiskCategory =
  | 'critical'
  | 'dead_stock'
  | 'slow_moving'
  | 'excess'
  | 'low_stock'
  | 'healthy';

export interface DemandStats {
  total_units_sold: number;
  observed_sale_days: number;
  window_days: number;
  first_sale_date: string | null;
  last_sale_date: string | null;
  days_since_last_sale: number | null;
  avg_daily_demand: number;
  weighted_daily_demand: number;
  insufficient_history: boolean;
}

export interface DemandForecast {
  daily_demand: number;
  forecast_7d_units: number;
  forecast_30d_units: number;
  method: string;
  is_machine_learning: boolean;
  uses_category_fallback: boolean;
  data_days_available: number;
  insufficient_history: boolean;
}

export interface StockoutPrediction {
  days_until_stockout: number | null;
  stockout_risk: StockoutRisk;
  out_of_stock: boolean;
  current_stock: number;
  avg_daily_demand: number;
  lead_time_days: number;
  lead_time_is_assumed: boolean;
  will_stockout_before_reorder: boolean;
}

export interface ReorderSupplier {
  supplier_id: number;
  supplier_name: string;
  lead_time_days: number;
  min_order_qty: number;
  unit_cost: string | null;
}

export interface ReorderExplanation {
  lookback_days: number;
  window_start: string | null;
  window_end: string | null;
  units_sold: number;
  avg_daily_sales: number;
  demand_basis: number;
  current_stock: number;
  lead_time_days: number;
  lead_time_source: string;
  lead_time_is_assumed: boolean;
  safety_stock: number;
  review_period_days: number;
  reorder_point_calculated: number;
  reorder_point_manual: number;
  effective_reorder_point: number;
  target_stock: number;
  suggested_qty: number;
  adjusted_for_moq: boolean;
  min_order_qty: number;
  formula_reorder_point: string;
  formula_target_stock: string;
  formula_suggested_qty: string;
  disclaimer: string;
}

export interface ReorderRecommendation {
  needs_reorder: boolean;
  configured_reorder_point: number;
  calculated_reorder_point: number;
  effective_reorder_point: number;
  current_stock: number;
  target_stock: number;
  raw_qty_needed: number;
  min_order_qty: number;
  reorder_qty: number;
  unit_cost: string | null;
  estimated_order_cost: string | null;
  supplier: ReorderSupplier | null;
  explanation: string[];
  explanation_details: ReorderExplanation;
  formula: string;
}

export interface RiskScore {
  risk_score: number;
  risk_category: RiskCategory;
  days_of_cover: number | null;
  reasons: string[];
  recommended_action: string;
}

export interface ProductIntelligence {
  product_id: number;
  sku: string;
  name: string;
  category_name: string | null;
  unit: string;
  is_active: boolean;
  current_stock: number;
  cost_price: string;
  demand_stats: DemandStats;
  forecast: DemandForecast;
  stockout_prediction: StockoutPrediction;
  reorder_recommendation: ReorderRecommendation;
  risk: RiskScore;
}

export interface IntelligenceCounts {
  total_products: number;
  needs_reorder: number;
  critical: number;
  low_stock: number;
  dead_stock: number;
  slow_moving: number;
  excess: number;
  healthy: number;
}

export interface IntelligenceSummary {
  generated_at: string;
  window_days: number;
  algorithm: string;
  risk_model_version: string;
  counts: IntelligenceCounts;
  items: ProductIntelligence[];
}

export interface ReorderQueue {
  generated_at: string;
  window_days: number;
  algorithm: string;
  total: number;
  items: ProductIntelligence[];
}

export interface RiskReport {
  generated_at: string;
  window_days: number;
  risk_model_version: string;
  counts: IntelligenceCounts;
  items: ProductIntelligence[];
}

export interface ForecastPoint {
  date: string;
  units: number;
  is_forecast: boolean;
}

export interface ForecastSeries {
  product_id: number;
  sku: string;
  name: string;
  method: string;
  daily_demand: number;
  history_days: number;
  forecast_days: number;
  points: ForecastPoint[];
}

export interface EvaluationMetrics {
  mae_model: number;
  mae_naive: number;
  wape_model: number | null;
  wape_naive: number | null;
  model_beats_naive_baseline: boolean | null;
}

export interface ForecastEvaluation {
  algorithm: string;
  train_window: { start: string; end: string; days: number };
  test_window: { start: string; end: string; days: number };
  products_evaluated: number;
  metrics: EvaluationMetrics;
  data_limitations: string[];
  per_product: Array<{
    product_id: number;
    sku: string;
    name: string;
    train_avg_daily: number;
    model_daily: number;
    actual_daily: number;
    ae_model: number;
    ae_naive: number;
    better_model: 'model' | 'naive' | 'tie';
  }>;
}
