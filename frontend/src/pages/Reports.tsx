import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BarChart3,
  DollarSign,
  Info,
  Layers,
  PackageX,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { KpiCard } from '../components/common/KpiCard';
import { DataTable, Column } from '../components/common/DataTable';
import { RiskBadge } from '../components/intelligence/RiskBadge';
import { ForecastChart } from '../components/intelligence/ForecastChart';
import { api } from '../api/client';
import { intelligenceApi } from '../api/intelligence';
import { formatCurrency, formatDate, formatDateTime } from '../utils/format';
import { forecastMethodLabel, forecastSourceNote } from '../utils/intelligence';
import type {
  InventoryItem,
  Sale,
  ProductIntelligence,
  Page,
  RiskCategory,
} from '../types';

interface CategoryValuation {
  category_name: string;
  sku_count: number;
  total_units: number;
  total_valuation: number;
}

const RISK_CATEGORIES: RiskCategory[] = [
  'critical',
  'dead_stock',
  'slow_moving',
  'excess',
  'low_stock',
  'healthy',
];

export const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'sales' | 'inventory' | 'dead_stock' | 'intelligence'
  >('sales');
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['reports-sales'],
    queryFn: () => api.get<Page<Sale>>('/sales', { limit: 200 }),
  });

  const { data: inventoryData, isLoading: invLoading } = useQuery({
    queryKey: ['reports-inventory'],
    queryFn: () => api.get<Page<InventoryItem>>('/inventory', { limit: 100 }),
  });

  const { data: summary, isLoading: intelligenceLoading } = useQuery({
    queryKey: ['intelligence-summary'],
    queryFn: () => intelligenceApi.summary(),
    staleTime: 60_000,
    enabled: activeTab === 'intelligence',
  });

  const { data: deadStockReport, isLoading: deadStockLoading } = useQuery({
    queryKey: ['intelligence-dead-stock'],
    queryFn: () => intelligenceApi.riskReport('dead_stock'),
    staleTime: 60_000,
    enabled: activeTab === 'dead_stock',
  });

  const { data: evaluation } = useQuery({
    queryKey: ['intelligence-evaluation'],
    queryFn: () => intelligenceApi.evaluation(),
    staleTime: 300_000,
    enabled: activeTab === 'intelligence',
  });

  const effectiveProductId = selectedProductId ?? summary?.items[0]?.product_id ?? null;

  const { data: forecastSeries, isLoading: forecastLoading } = useQuery({
    queryKey: ['intelligence-forecast', effectiveProductId],
    queryFn: () => intelligenceApi.forecast(effectiveProductId as number, 30, 14),
    enabled: activeTab === 'intelligence' && effectiveProductId !== null,
    staleTime: 60_000,
  });

  // Sales Analytics computations (unchanged: straight from the sales ledger)
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

  // Dead stock now comes from the Intelligence API: zero completed sales in the
  // analysis window. Previously this was inferred client-side from a page of sales.
  const deadStockItems = deadStockReport?.items ?? [];

  const deadStockCapital = useMemo(() => {
    return deadStockItems.reduce(
      (acc, item) => acc + parseFloat(item.cost_price || '0') * item.current_stock,
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

  const deadStockColumns: Column<ProductIntelligence>[] = [
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
      accessorKey: 'current_stock',
      align: 'right',
      cell: (item) => `${item.current_stock} ${item.unit}`,
    },
    {
      header: 'Last Sale',
      align: 'right',
      cell: (item) =>
        item.demand_stats.last_sale_date
          ? formatDate(item.demand_stats.last_sale_date)
          : 'No sale in window',
    },
    {
      header: 'Cost Price',
      accessorKey: 'cost_price',
      align: 'right',
      cell: (item) => formatCurrency(item.cost_price),
    },
    {
      header: 'Tied-up Capital',
      align: 'right',
      cell: (item) => (
        <span className="font-semibold text-rose-700 tabular-nums">
          {formatCurrency(parseFloat(item.cost_price) * item.current_stock)}
        </span>
      ),
    },
    {
      header: 'Recommended Action',
      cell: (item) => (
        <span className="text-[11px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-medium">
          {item.risk.recommended_action}
        </span>
      ),
    },
  ];

  const riskColumns: Column<ProductIntelligence>[] = [
    {
      header: 'Product',
      cell: (item) => (
        <div>
          <span className="font-semibold text-on-surface block">{item.name}</span>
          <span className="font-mono text-[11px] text-primary">{item.sku}</span>
        </div>
      ),
    },
    {
      header: 'Category',
      cell: (item) => item.category_name || 'General',
    },
    {
      header: 'Risk',
      cell: (item) => (
        <RiskBadge category={item.risk.risk_category} score={item.risk.risk_score} />
      ),
    },
    {
      header: 'Days of Cover',
      align: 'right',
      cell: (item) =>
        item.risk.days_of_cover === null ? '—' : `${item.risk.days_of_cover} days`,
    },
    {
      header: 'Why',
      cell: (item) => (
        <span className="text-[11px] text-on-surface-variant">
          {item.risk.reasons.join(' ')}
        </span>
      ),
    },
    {
      header: 'Action',
      cell: (item) => (
        <span className="text-[11px] text-on-surface">{item.risk.recommended_action}</span>
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

  const selectedForecastProduct = summary?.items.find(
    (i) => i.product_id === effectiveProductId
  );

  const metrics = evaluation?.metrics;
  const betterBaseline =
    metrics?.model_beats_naive_baseline === true
      ? 'Weighted average had lower error on this holdout'
      : metrics?.model_beats_naive_baseline === false
      ? 'Naive average had lower error on this holdout'
      : 'Not enough data to compare';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytical Intelligence"
        subtitle="Financial performance audits, category valuations, demand baselines and inventory risk diagnostics."
      />

      <div className="flex flex-wrap border-b border-outline-variant/30 gap-6 text-[13px] font-medium">
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
          onClick={() => setActiveTab('intelligence')}
          className={`pb-3 transition-colors ${
            activeTab === 'intelligence'
              ? 'border-b-2 border-primary text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Demand & Risk
        </button>
        <button
          onClick={() => setActiveTab('dead_stock')}
          className={`pb-3 transition-colors ${
            activeTab === 'dead_stock'
              ? 'border-b-2 border-primary text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Dead Stock Diagnostic ({deadStockReport?.items.length ?? deadStockItems.length})
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
                Sales metrics are computed directly from the verified sales ledger. Demand
                baselines and their measured accuracy are shown on the Demand &amp; Risk tab.
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

      {activeTab === 'intelligence' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              title="Products Analysed"
              value={summary?.counts.total_products ?? 0}
              subtitle={`${summary?.window_days ?? 30}-day sales window`}
              icon={Activity}
            />
            <KpiCard
              title="Needs Reorder"
              value={summary?.counts.needs_reorder ?? 0}
              subtitle="Advisory suggestions"
              icon={ShoppingBag}
            />
            <KpiCard
              title="Slow / Dead Stock"
              value={(summary?.counts.slow_moving ?? 0) + (summary?.counts.dead_stock ?? 0)}
              subtitle="Capital at risk"
              icon={PackageX}
            />
            <KpiCard
              title="Excess Inventory"
              value={summary?.counts.excess ?? 0}
              subtitle="Over 90 days of cover"
              icon={Layers}
            />
          </div>

          <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-[14px] text-on-surface">
                  Demand baseline &amp; 14-day projection
                </h3>
                <p className="text-[12px] text-on-surface-variant mt-0.5">
                  Solid line: recorded completed sales. Dashed line: flat projection at the
                  documented demand baseline — not a machine-learning forecast.
                </p>
              </div>
              <select
                value={effectiveProductId ?? ''}
                onChange={(e) => setSelectedProductId(Number(e.target.value))}
                className="h-9 px-3 rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-[12px] text-on-surface"
                aria-label="Select product for forecast"
              >
                {summary?.items.map((item) => (
                  <option key={item.product_id} value={item.product_id}>
                    {item.sku} — {item.name}
                  </option>
                ))}
              </select>
            </div>

            {forecastSeries ? (
              <>
                <ForecastChart series={forecastSeries} />
                <div className="text-[12px] text-on-surface-variant space-y-1">
                  <p>
                    <span className="font-semibold text-on-surface">Method: </span>
                    {forecastMethodLabel(forecastSeries.method)}
                  </p>
                  {selectedForecastProduct && (
                    <p>{forecastSourceNote(selectedForecastProduct)}</p>
                  )}
                  <p>
                    Baseline: {forecastSeries.daily_demand} units/day · 7-day projection:{' '}
                    {selectedForecastProduct?.forecast.forecast_7d_units ?? '—'} units ·
                    30-day projection:{' '}
                    {selectedForecastProduct?.forecast.forecast_30d_units ?? '—'} units.
                  </p>
                </div>
              </>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-[12px] text-on-surface-variant">
                {forecastLoading ? 'Loading demand series…' : 'No demand data available.'}
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs space-y-3">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-[14px] text-on-surface">
                  Time-based evaluation (no training, no claimed ML accuracy)
                </h3>
                <p className="text-[12px] text-on-surface-variant">
                  {evaluation
                    ? `${evaluation.train_window.days}-day train window (${evaluation.train_window.start} → ${evaluation.train_window.end}) vs ${evaluation.test_window.days}-day holdout (${evaluation.test_window.start} → ${evaluation.test_window.end}); ${evaluation.products_evaluated} products.`
                    : 'Loading evaluation…'}
                </p>
              </div>
            </div>
            {metrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
                <div className="p-3 rounded-lg bg-surface-container-low">
                  <span className="block text-on-surface-variant">MAE — weighted avg</span>
                  <strong className="text-[16px] tabular-nums">{metrics.mae_model}</strong>
                </div>
                <div className="p-3 rounded-lg bg-surface-container-low">
                  <span className="block text-on-surface-variant">MAE — naive mean</span>
                  <strong className="text-[16px] tabular-nums">{metrics.mae_naive}</strong>
                </div>
                <div className="p-3 rounded-lg bg-surface-container-low">
                  <span className="block text-on-surface-variant">WAPE — weighted avg</span>
                  <strong className="text-[16px] tabular-nums">
                    {metrics.wape_model === null ? 'undefined' : metrics.wape_model}
                  </strong>
                </div>
                <div className="p-3 rounded-lg bg-surface-container-low">
                  <span className="block text-on-surface-variant">WAPE — naive mean</span>
                  <strong className="text-[16px] tabular-nums">
                    {metrics.wape_naive === null ? 'undefined' : metrics.wape_naive}
                  </strong>
                </div>
              </div>
            )}
            {metrics && (
              <p className="text-[12px] font-medium text-on-surface">{betterBaseline}</p>
            )}
            {evaluation && (
              <ul className="list-disc list-inside text-[11px] text-on-surface-variant space-y-1">
                {evaluation.data_limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-[14px] text-on-surface">Inventory risk register</h3>
              <p className="text-[12px] text-on-surface-variant">
                Scores are rule-based (0–100) and every row includes the reason and an action.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {RISK_CATEGORIES.map((category) => (
                <RiskBadge
                  key={category}
                  category={category}
                  score={summary?.counts[category]}
                />
              ))}
            </div>
            <DataTable
              columns={riskColumns}
              data={summary?.items ?? []}
              keyExtractor={(item) => item.product_id}
              isLoading={intelligenceLoading}
              emptyTitle="No products to assess"
              emptyDescription="Add products with inventory and sales history to see risk scoring."
            />
          </div>
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
                Verified against completed sales in the last{' '}
                {deadStockReport?.window_days ?? 30} days, locking{' '}
                <span className="font-bold">{formatCurrency(deadStockCapital)}</span> in working
                capital.
              </p>
            </div>
          </div>

          <DataTable
            columns={deadStockColumns}
            data={deadStockItems}
            keyExtractor={(item) => item.product_id}
            isLoading={deadStockLoading}
            emptyTitle="No dead stock detected"
            emptyDescription="All products with active inventory have recorded sales movement."
          />
        </div>
      )}
    </div>
  );
};
