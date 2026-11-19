import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  DollarSign,
  PackageX,
  ShoppingBag,
  Info,
  Layers,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { KpiCard } from '../components/common/KpiCard';
import { DataTable, Column } from '../components/common/DataTable';
import { api } from '../api/client';
import { formatCurrency, formatDateTime } from '../utils/format';
import type { Page, Product, InventoryItem, Sale } from '../types';

interface CategoryValuation {
  category_name: string;
  sku_count: number;
  total_units: number;
  total_valuation: number;
}

export const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'dead_stock'>('sales');

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['reports-sales'],
    queryFn: () => api.get<Page<Sale>>('/sales', { limit: 200 }),
  });

  const { data: productsData } = useQuery({
    queryKey: ['reports-products'],
    queryFn: () => api.get<Page<Product>>('/products', { limit: 100 }),
  });

  const { data: inventoryData, isLoading: invLoading } = useQuery({
    queryKey: ['reports-inventory'],
    queryFn: () => api.get<Page<InventoryItem>>('/inventory', { limit: 100 }),
  });

  // Sales Analytics computations
  const completedSales = useMemo(() => {
    return salesData?.items.filter((s) => s.status === 'completed') || [];
  }, [salesData]);

  const totalRevenue = useMemo(() => {
    return completedSales.reduce((acc, s) => acc + (parseFloat(s.total_amount) || 0), 0);
  }, [completedSales]);

  const avgBasketSize = useMemo(() => {
    return completedSales.length > 0 ? totalRevenue / completedSales.length : 0;
  }, [completedSales, totalRevenue]);

  // Category Valuation computations
  const categoryValuations = useMemo(() => {
    const items = inventoryData?.items || [];
    const map = new Map<string, { sku_count: number; total_units: number; total_valuation: number }>();

    items.forEach((item) => {
      const cat = item.category_name || 'General';
      const existing = map.get(cat) || { sku_count: 0, total_units: 0, total_valuation: 0 };
      existing.sku_count += 1;
      existing.total_units += item.quantity;
      existing.total_valuation += parseFloat(item.stock_value) || 0;
      map.set(cat, existing);
    });

    return Array.from(map.entries()).map(([category_name, data]) => ({
      category_name,
      ...data,
    }));
  }, [inventoryData]);

  const totalInventoryValuation = useMemo(() => {
    return categoryValuations.reduce((acc, c) => acc + c.total_valuation, 0);
  }, [categoryValuations]);

  // Dead Stock Diagnostic
  const deadStockItems = useMemo(() => {
    const soldProductIds = new Set<number>();
    completedSales.forEach((s) => s.items?.forEach((i) => soldProductIds.add(i.product_id)));

    const products = productsData?.items || [];
    return products.filter((p) => p.stock_on_hand > 0 && !soldProductIds.has(p.id));
  }, [productsData, completedSales]);

  const deadStockCapital = useMemo(() => {
    return deadStockItems.reduce(
      (acc, p) => acc + (parseFloat(p.cost_price) || 0) * p.stock_on_hand,
      0
    );
  }, [deadStockItems]);

  const categoryColumns: Column<CategoryValuation>[] = [
    {
      header: 'Category',
      accessorKey: 'category_name',
      cell: (c) => <span className="font-semibold text-on-surface">{c.category_name}</span>,
    },
    {
      header: 'Distinct SKUs',
      accessorKey: 'sku_count',
      align: 'right',
      cell: (c) => <span className="tabular-nums font-mono text-[12px]">{c.sku_count}</span>,
    },
    {
      header: 'Stock Quantity',
      accessorKey: 'total_units',
      align: 'right',
      cell: (c) => <span className="tabular-nums font-medium">{c.total_units} units</span>,
    },
    {
      header: 'Total Valuation',
      accessorKey: 'total_valuation',
      align: 'right',
      cell: (c) => (
        <span className="font-bold text-emerald-800 tabular-nums">
          {formatCurrency(c.total_valuation)}
        </span>
      ),
    },
    {
      header: '% of Total Inventory',
      align: 'right',
      cell: (c) => (
        <span className="tabular-nums text-on-surface-variant font-medium">
          {totalInventoryValuation > 0
            ? `${((c.total_valuation / totalInventoryValuation) * 100).toFixed(1)}%`
            : '0%'}
        </span>
      ),
    },
  ];

  const deadStockColumns: Column<Product>[] = [
    {
      header: 'SKU',
      accessorKey: 'sku',
      className: 'font-mono text-primary font-semibold text-[12px]',
    },
    {
      header: 'Product Name',
      accessorKey: 'name',
    },
    {
      header: 'Current Stock',
      accessorKey: 'stock_on_hand',
      align: 'right',
      cell: (p) => `${p.stock_on_hand} ${p.unit}`,
    },
    {
      header: 'Cost Price',
      accessorKey: 'cost_price',
      align: 'right',
      cell: (p) => formatCurrency(p.cost_price),
    },
    {
      header: 'Tied-up Capital',
      align: 'right',
      cell: (p) => (
        <span className="font-semibold text-rose-700 tabular-nums">
          {formatCurrency(parseFloat(p.cost_price) * p.stock_on_hand)}
        </span>
      ),
    },
    {
      header: 'Recommended Action',
      cell: () => (
        <span className="text-[11px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-medium">
          Clearance Promotion
        </span>
      ),
    },
  ];

  const salesColumns: Column<Sale>[] = [
    {
      header: 'Order ID',
      accessorKey: 'id',
      cell: (s) => <span className="font-mono text-primary font-semibold">SALE-{s.id}</span>,
    },
    {
      header: 'Timestamp',
      accessorKey: 'sold_at',
      cell: (s) => formatDateTime(s.sold_at),
    },
    {
      header: 'Customer',
      accessorKey: 'customer_name',
      cell: (s) => s.customer_name || 'Walk-in Customer',
    },
    {
      header: 'Items Count',
      align: 'right',
      cell: (s) => <span className="tabular-nums">{s.items.length} lines</span>,
    },
    {
      header: 'Total Amount',
      accessorKey: 'total_amount',
      align: 'right',
      cell: (s) => (
        <span className="font-bold text-on-surface tabular-nums">
          {formatCurrency(s.total_amount)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytical Intelligence"
        subtitle="Financial performance audits, category valuations, and inactive capital diagnostics."
      />

      <div className="flex border-b border-outline-variant/30 gap-6 text-[13px] font-medium">
        <button
          onClick={() => setActiveTab('sales')}
          className={`pb-3 transition-colors ${
            activeTab === 'sales'
              ? 'border-b-2 border-primary text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Sales Performance
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`pb-3 transition-colors ${
            activeTab === 'inventory'
              ? 'border-b-2 border-primary text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Category Valuation
        </button>
        <button
          onClick={() => setActiveTab('dead_stock')}
          className={`pb-3 transition-colors ${
            activeTab === 'dead_stock'
              ? 'border-b-2 border-primary text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Dead Stock Diagnostic ({deadStockItems.length})
        </button>
      </div>

      {activeTab === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              title="Verified Revenue"
              value={formatCurrency(totalRevenue)}
              subtitle={`${completedSales.length} completed transactions`}
              icon={DollarSign}
            />
            <KpiCard
              title="Completed Orders"
              value={String(completedSales.length)}
              subtitle="All verified POS receipts"
              icon={ShoppingBag}
            />
            <KpiCard
              title="Average Basket Size"
              value={formatCurrency(avgBasketSize)}
              subtitle="Revenue per transaction"
              icon={BarChart3}
            />
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-start gap-3 text-[12px] text-on-surface-variant">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-on-surface block">Analytics Data Note</span>
              <span>
                Sales metrics are computed directly from the verified sales ledger. Full COGS margin decomposition and historical forecasting will connect to Phase 3 Intelligence endpoints.
              </span>
            </div>
          </div>

          <DataTable
            columns={salesColumns}
            data={completedSales.slice(0, 15)}
            keyExtractor={(s) => s.id}
            isLoading={salesLoading}
            emptyTitle="No completed sales"
            emptyDescription="Process transactions in POS to view performance telemetry."
          />
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KpiCard
              title="Total Inventory Valuation"
              value={formatCurrency(totalInventoryValuation)}
              subtitle="Sum of cost_price × quantity"
              icon={DollarSign}
            />
            <KpiCard
              title="Active Categories"
              value={String(categoryValuations.length)}
              subtitle="Distinct stationery categories"
              icon={Layers}
            />
          </div>

          <DataTable
            columns={categoryColumns}
            data={categoryValuations}
            keyExtractor={(c) => c.category_name}
            isLoading={invLoading}
            emptyTitle="No category valuation data"
            emptyDescription="Add products and inventory balances to see valuation distributions."
          />
        </div>
      )}

      {activeTab === 'dead_stock' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[13px] flex items-start gap-3">
            <PackageX className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-[13px]">
                {deadStockItems.length} Zero-Sales Products Identified
              </h4>
              <p className="text-[12px] text-amber-800 mt-0.5">
                These inventory items have recorded zero sales transactions in recent history, locking{' '}
                <span className="font-bold">{formatCurrency(deadStockCapital)}</span> in working capital.
              </p>
            </div>
          </div>

          <DataTable
            columns={deadStockColumns}
            data={deadStockItems}
            keyExtractor={(p) => p.id}
            emptyTitle="No dead stock detected"
            emptyDescription="All products with active inventory have recorded sales movement."
          />
        </div>
      )}
    </div>
  );
};
