import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Package,
  IndianRupee,
  AlertTriangle,
  Receipt,
  ShoppingCart,
  Truck,
  Plus,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  BarChart2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { PageHeader } from '../components/common/PageHeader';
import { KpiCard } from '../components/common/KpiCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { ErrorState } from '../components/common/ErrorState';
import { api } from '../api/client';
import { formatCurrency, formatDateTime } from '../utils/format';
import type { Page, Product, InventoryItem, Sale } from '../types';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [viewState, setViewState] = useState<'default' | 'loading' | 'error'>('default');

  // Fetch products summary
  const {
    data: productsData,
    isLoading: productsLoading,
    error: productsError,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ['dashboard-products'],
    queryFn: () => api.get<Page<Product>>('/products', { limit: 100 }),
  });

  // Fetch inventory summary
  const {
    data: inventoryData,
    isLoading: invLoading,
    refetch: refetchInventory,
  } = useQuery({
    queryKey: ['dashboard-inventory'],
    queryFn: () => api.get<Page<InventoryItem>>('/inventory', { limit: 100 }),
  });

  // Fetch sales summary (last 100 sales to compute 7-day velocity)
  const {
    data: salesData,
    isLoading: salesLoading,
    refetch: refetchSales,
  } = useQuery({
    queryKey: ['dashboard-sales'],
    queryFn: () => api.get<Page<Sale>>('/sales', { limit: 100 }),
  });

  const refetchAll = () => {
    refetchProducts();
    refetchInventory();
    refetchSales();
  };

  const isLoading = viewState === 'loading' || productsLoading || invLoading || salesLoading;
  const isError = viewState === 'error' || !!productsError;

  // Active products count
  const totalProducts = productsData?.total || 0;
  const activeProducts = productsData?.items.filter((p) => p.is_active).length || 0;

  // Total inventory cost valuation
  const totalStockValue = useMemo(() => {
    if (!inventoryData?.items) return 0;
    return inventoryData.items.reduce((acc, item) => acc + parseFloat(item.stock_value || '0'), 0);
  }, [inventoryData]);

  // Low stock products
  const lowStockItems = useMemo(() => {
    if (!inventoryData?.items) return [];
    return inventoryData.items.filter((item) => item.quantity <= item.reorder_point);
  }, [inventoryData]);

  // Sales aggregates
  const recentSales = salesData?.items || [];

  // Today's sales calculation (UTC calendar day)
  const todayRevenue = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return recentSales
      .filter((s) => s.status === 'completed' && s.sold_at.startsWith(todayStr))
      .reduce((acc, s) => acc + parseFloat(s.total_amount || '0'), 0);
  }, [recentSales]);

  // Seven-day revenue chart data
  const revenueChartData = useMemo(() => {
    const days: { dateStr: string; label: string; revenue: number }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const isoDate = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
      days.push({ dateStr: isoDate, label: dayLabel, revenue: 0 });
    }

    if (salesData?.items) {
      salesData.items.forEach((sale) => {
        if (sale.status === 'completed') {
          const sDate = sale.sold_at.split('T')[0];
          const match = days.find((d) => d.dateStr === sDate);
          if (match) {
            match.revenue += parseFloat(sale.total_amount || '0');
          }
        }
      });
    }

    return days;
  }, [salesData]);

  return (
    <div className="space-y-6">
      {/* Header with quick refresh and prototype inspector */}
      <PageHeader
        title="Operational Cockpit"
        subtitle="Live telemetry, store inventory valuation, and algorithmic replenishment signals."
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-overline text-[10px] font-semibold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            Stationery & Gifts · Store #1
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {/* View State Switcher */}
            <div className="hidden md:flex items-center gap-1 bg-surface-container-low p-1 rounded-lg border border-outline-variant/30 text-caption text-on-surface-variant">
              <span className="px-2 font-overline uppercase tracking-wider text-[10px]">State:</span>
              <button
                type="button"
                onClick={() => setViewState('default')}
                className={`px-2 py-0.5 rounded font-medium text-[11px] transition-all ${
                  viewState === 'default'
                    ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                    : 'hover:text-on-surface'
                }`}
              >
                Live
              </button>
              <button
                type="button"
                onClick={() => setViewState('loading')}
                className={`px-2 py-0.5 rounded font-medium text-[11px] transition-all ${
                  viewState === 'loading'
                    ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                    : 'hover:text-on-surface'
                }`}
              >
                Skeleton
              </button>
              <button
                type="button"
                onClick={() => setViewState('error')}
                className={`px-2 py-0.5 rounded font-medium text-[11px] transition-all ${
                  viewState === 'error'
                    ? 'bg-surface-container-lowest text-error shadow-xs font-semibold'
                    : 'hover:text-on-surface'
                }`}
              >
                Error
              </button>
            </div>

            <button
              onClick={refetchAll}
              className="h-9 px-3 rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-colors flex items-center gap-1.5 text-[12px] font-medium shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-on-surface-variant" />
              <span>Sync Telemetry</span>
            </button>
          </div>
        }
      />

      {isError ? (
        <ErrorState
          title="Telemetry Connection Failed"
          message="Could not reach the FastAPI backend at http://localhost:8000. Verify the backend server is running."
          onRetry={() => {
            setViewState('default');
            refetchAll();
          }}
        />
      ) : isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-32 bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/30 animate-pulse shadow-xs"
              />
            ))}
          </div>
          <LoadingSkeleton rows={6} />
        </div>
      ) : (
        <>
          {/* 4 Hero KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Active SKUs"
              value={activeProducts}
              subtitle={`of ${totalProducts} in catalog`}
              icon={Package}
              iconBgColor="bg-primary/10"
              iconColor="text-primary"
              trend={{ value: 'Live Catalog', isPositive: true }}
            />

            <KpiCard
              title="Inventory Valuation"
              value={formatCurrency(totalStockValue)}
              subtitle="Total acquisition cost"
              icon={IndianRupee}
              iconBgColor="bg-emerald-500/10"
              iconColor="text-emerald-700"
              trend={{ value: 'Ledger Synced', isPositive: true }}
            />

            <KpiCard
              title="Low Stock Items"
              value={lowStockItems.length}
              subtitle="At or below safety threshold"
              icon={AlertTriangle}
              iconBgColor="bg-amber-500/10"
              iconColor="text-amber-700"
              trend={{
                value: lowStockItems.length > 0 ? 'Restock Required' : 'Optimal',
                isNeutral: lowStockItems.length === 0,
              }}
            />

            <KpiCard
              title="Today's Sales"
              value={formatCurrency(todayRevenue)}
              subtitle="Recorded POS revenue"
              icon={Receipt}
              iconBgColor="bg-secondary/10"
              iconColor="text-secondary"
              trend={{ value: `${recentSales.length} Total Sales`, isPositive: true }}
            />
          </div>

          {/* Quick Action Navigation Bar */}
          <div className="rounded-xl bg-surface-container-lowest p-4 border border-outline-variant/30 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="font-overline text-[11px] text-on-surface-variant font-semibold uppercase tracking-wider">
                Quick Actions:
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => navigate('/pos')}
                className="h-8 px-3.5 rounded-lg bg-primary text-white font-medium text-[12px] hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>New POS Sale</span>
              </button>
              <button
                onClick={() => navigate('/purchases')}
                className="h-8 px-3.5 rounded-lg border border-outline-variant/40 bg-surface-container-low text-on-surface hover:bg-surface-container font-medium text-[12px] transition-colors flex items-center gap-1.5"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Receive Purchase</span>
              </button>
              <button
                onClick={() => navigate('/products')}
                className="h-8 px-3.5 rounded-lg border border-outline-variant/40 bg-surface-container-low text-on-surface hover:bg-surface-container font-medium text-[12px] transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product</span>
              </button>
            </div>
          </div>

          {/* 7-Day Revenue Trend Chart */}
          <div className="rounded-xl bg-surface-container-lowest p-5 border border-outline-variant/30 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <BarChart2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-section-title text-[15px] font-semibold text-on-surface">
                    7-Day Sales Revenue Velocity
                  </h3>
                  <p className="font-caption text-[11px] text-on-surface-variant">
                    Daily completed POS transaction volume in ₹ (INR)
                  </p>
                </div>
              </div>
              <span className="text-[12px] font-semibold text-primary font-mono tabular-nums">
                {formatCurrency(revenueChartData.reduce((acc, d) => acc + d.revenue, 0))} Total (7d)
              </span>
            </div>

            <div className="h-48 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `₹${val}`}
                  />
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(val), 'Revenue']}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Dual Column: Needs Reordering + Recent Sales */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Needs Reordering Digest */}
            <div className="lg:col-span-5 rounded-xl bg-surface-container-lowest p-5 border border-outline-variant/30 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-section-title text-[15px] font-semibold text-on-surface">
                        Restock Required ({lowStockItems.length})
                      </h3>
                      <p className="font-caption text-[11px] text-on-surface-variant">
                        Products at or below safety point
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/alerts')}
                    className="text-[12px] text-primary hover:underline font-medium flex items-center gap-1"
                  >
                    <span>View all</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  {lowStockItems.slice(0, 5).map((item) => (
                    <div
                      key={item.product_id}
                      onClick={() => navigate(`/products/${item.product_id}`)}
                      className="p-3 rounded-lg bg-surface-container-low/60 border border-outline-variant/20 flex items-center justify-between gap-3 hover:bg-surface-container cursor-pointer transition-colors"
                    >
                      <div className="truncate">
                        <span className="font-body-medium text-[13px] font-semibold text-on-surface truncate block">
                          {item.name}
                        </span>
                        <span className="text-[11px] text-on-surface-variant font-mono">
                          {item.sku} · Reorder @ {item.reorder_point}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <span className="text-[13px] font-bold text-rose-700 tabular-nums block">
                            {item.quantity} {item.unit}
                          </span>
                        </div>
                        <StatusBadge status="low_stock" />
                      </div>
                    </div>
                  ))}

                  {lowStockItems.length === 0 && (
                    <div className="p-8 text-center text-caption text-on-surface-variant">
                      All products currently have healthy inventory reserves.
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-outline-variant/20 flex items-center justify-between text-caption text-on-surface-variant">
                <span>Replenishment signals active</span>
                <span className="font-medium text-emerald-700 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Ledger Verified
                </span>
              </div>
            </div>

            {/* Recent Sales Ledger */}
            <div className="lg:col-span-7 rounded-xl bg-surface-container-lowest p-5 border border-outline-variant/30 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-section-title text-[15px] font-semibold text-on-surface">
                        Recent Store Transactions
                      </h3>
                      <p className="font-caption text-[11px] text-on-surface-variant">
                        Latest POS checkout receipts
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/sales')}
                    className="text-[12px] text-primary hover:underline font-medium flex items-center gap-1"
                  >
                    <span>Full Ledger</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant/30 text-overline text-[10px] text-on-surface-variant uppercase tracking-wider">
                        <th className="py-2 px-3">Order ID</th>
                        <th className="py-2 px-3">Timestamp</th>
                        <th className="py-2 px-3">Customer</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20 text-[12px]">
                      {recentSales.slice(0, 5).map((sale) => (
                        <tr key={sale.id} className="hover:bg-surface-container-low/40">
                          <td className="py-2.5 px-3 font-mono font-medium text-primary">
                            #{sale.id}
                          </td>
                          <td className="py-2.5 px-3 text-on-surface-variant">
                            {formatDateTime(sale.sold_at)}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-on-surface">
                            {sale.customer_name || 'Walk-in Customer'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-on-surface">
                            {formatCurrency(sale.total_amount)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <StatusBadge status={sale.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-outline-variant/20 text-caption text-on-surface-variant flex items-center justify-between">
                <span>Displaying latest 5 store sales</span>
                <button
                  onClick={() => navigate('/pos')}
                  className="font-medium text-primary hover:underline"
                >
                  Open POS Terminal →
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
