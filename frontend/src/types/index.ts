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
