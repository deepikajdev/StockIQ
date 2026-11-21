import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Clock, ShoppingCart, Star, TrendingUp } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { KpiCard } from '../components/common/KpiCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { DataTable, Column } from '../components/common/DataTable';
import { RiskBadge } from '../components/intelligence/RiskBadge';
import { ForecastChart } from '../components/intelligence/ForecastChart';
import { api } from '../api/client';
import { intelligenceApi } from '../api/intelligence';
import { formatCurrency, formatDateTime, formatSignedDelta } from '../utils/format';
import {
  forecastMethodLabel,
  forecastSourceNote,
  STOCKOUT_LABELS,
} from '../utils/intelligence';
import type {
  Product,
  ProductSupplier,
  Page,
  MovementOut,
  ProductIntelligence,
  ForecastSeries,
} from '../types';

export const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'forecast' | 'suppliers' | 'movements'
  >('overview');
  const [movementOffset, setMovementOffset] = useState(0);
  const movementLimit = 25;

  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get<Product>(`/products/${id}`),
    enabled: !!id,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['product-suppliers', id],
    queryFn: () => api.get<ProductSupplier[]>(`/products/${id}/suppliers`),
    enabled: !!id,
  });

  const { data: movementsData, isLoading: movementsLoading } = useQuery({
    queryKey: ['product-movements', id, movementOffset],
    queryFn: () =>
      api.get<Page<MovementOut>>('/inventory/movements', {
        product_id: id ? Number(id) : undefined,
        limit: movementLimit,
        offset: movementOffset,
      }),
    enabled: !!id && activeTab === 'movements',
  });

  const { data: intelligence, isLoading: intelligenceLoading } = useQuery({
    queryKey: ['product-intelligence', id],
    queryFn: () => intelligenceApi.product(Number(id)),
    enabled: !!id && activeTab === 'forecast',
    staleTime: 60_000,
  });

  const { data: forecastSeries, isLoading: forecastLoading } = useQuery({
    queryKey: ['product-forecast', id],
    queryFn: () => intelligenceApi.forecast(Number(id), 30, 14),
    enabled: !!id && activeTab === 'forecast',
    staleTime: 60_000,
  });

  if (isLoading) {
    return <div className="p-8 text-center text-on-surface-variant">Loading product details...</div>;
  }

  if (error || !product) {
    return (
      <div className="p-8 text-center text-rose-700">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        <p>Product not found</p>
        <button onClick={() => navigate('/products')} className="mt-4 text-primary underline">
          Back to Products
        </button>
      </div>
    );
  }

  const supplierColumns: Column<ProductSupplier>[] = [
    {
      header: 'Supplier Name',
      accessorKey: 'supplier_name',
      cell: (ps) => (
        <div className="flex items-center gap-1.5 font-medium text-on-surface">
          {ps.is_preferred && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
          <span>{ps.supplier_name}</span>
        </div>
      ),
    },
    {
      header: 'Unit Cost',
      accessorKey: 'unit_cost',
      align: 'right',
      cell: (ps) => (ps.unit_cost ? formatCurrency(ps.unit_cost) : '—'),
    },
    {
      header: 'Lead Time',
      accessorKey: 'lead_time_days',
      align: 'right',
      cell: (ps) => (ps.lead_time_days ? `${ps.lead_time_days} days` : 'Unknown'),
    },
    {
      header: 'Min Order Qty',
      accessorKey: 'min_order_qty',
      align: 'right',
      cell: (ps) => (ps.min_order_qty ? `${ps.min_order_qty} units` : 'None'),
    },
  ];

  const movementColumns: Column<MovementOut>[] = [
    {
      header: 'Timestamp',
      accessorKey: 'created_at',
      cell: (m) => formatDateTime(m.created_at),
    },
    {
      header: 'Type',
      accessorKey: 'movement_type',
      cell: (m) => (
        <span className="font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 rounded bg-surface-container font-semibold">
          {m.movement_type.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      header: 'Delta',
      accessorKey: 'quantity_change',
      align: 'right',
      cell: (m) => (
        <span
          className={`font-bold tabular-nums text-[13px] px-2 py-0.5 rounded-full ${
            m.quantity_change > 0
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-700'
          }`}
        >
          {formatSignedDelta(m.quantity_change)}
        </span>
      ),
    },
    {
      header: 'Balance (Before → After)',
      align: 'right',
      cell: (m) => (
        <span className="font-mono text-[12px] tabular-nums text-on-surface-variant">
          {m.quantity_before} → <span className="font-bold text-on-surface">{m.quantity_after}</span>
        </span>
      ),
    },
    {
      header: 'Reference',
      cell: (m) => (
        <span className="text-[12px] text-on-surface-variant">
          {m.reference_type ? `${m.reference_type} #${m.reference_id}` : m.reason || 'Manual'}
        </span>
      ),
    },
    {
      header: 'Recorded By',
      accessorKey: 'user_name',
      cell: (m) => <span className="text-[12px] text-on-surface-variant">{m.user_name || 'System'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/products')}
        className="text-[13px] text-on-surface-variant hover:text-primary flex items-center gap-1 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Product Catalog</span>
      </button>

      <PageHeader
        title={product.name}
        subtitle={`SKU: ${product.sku} · Category: ${product.category_name || 'General'}`}
        badge={
          <StatusBadge
            status={
              !product.is_active
                ? 'inactive'
                : product.stock_on_hand <= product.reorder_point
                ? 'low_stock'
                : 'in_stock'
            }
          />
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-outline-variant/30 gap-6 text-[13px] font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 transition-colors ${
            activeTab === 'overview'
              ? 'border-b-2 border-primary text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Overview & Economics
        </button>
        <button
          onClick={() => setActiveTab('forecast')}
          className={`pb-3 transition-colors ${
            activeTab === 'forecast'
              ? 'border-b-2 border-primary text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Demand Forecast & Risk
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`pb-3 transition-colors ${
            activeTab === 'suppliers'
              ? 'border-b-2 border-primary text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Suppliers ({suppliers?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`pb-3 transition-colors ${
            activeTab === 'movements'
              ? 'border-b-2 border-primary text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Movement Ledger
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 space-y-3">
            <span className="font-overline text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
              Stock Reserves
            </span>
            <div className="text-[28px] font-bold text-on-surface tabular-nums">
              {product.stock_on_hand} <span className="text-[16px] font-normal">{product.unit}</span>
            </div>
            <div className="text-[12px] text-on-surface-variant flex justify-between border-t border-outline-variant/20 pt-2">
              <span>Reorder Point:</span>
              <span className="font-semibold">{product.reorder_point}</span>
            </div>
            <div className="text-[12px] text-on-surface-variant flex justify-between">
              <span>Safety Stock:</span>
              <span className="font-semibold">{product.safety_stock}</span>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 space-y-3">
            <span className="font-overline text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
              Pricing & Margin
            </span>
            <div className="text-[28px] font-bold text-emerald-700 tabular-nums">
              {formatCurrency(product.selling_price)}
            </div>
            <div className="text-[12px] text-on-surface-variant flex justify-between border-t border-outline-variant/20 pt-2">
              <span>Cost Price:</span>
              <span className="font-semibold">{formatCurrency(product.cost_price)}</span>
            </div>
            <div className="text-[12px] text-on-surface-variant flex justify-between">
              <span>Gross Margin:</span>
              <span className="font-semibold text-emerald-700">
                {(
                  ((parseFloat(product.selling_price) - parseFloat(product.cost_price)) /
                    (parseFloat(product.selling_price) || 1)) *
                  100
                ).toFixed(1)}
                %
              </span>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 space-y-3">
            <span className="font-overline text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
              Stock Status Telemetry
            </span>
            <div className="flex items-center gap-2 pt-1">
              <Clock className="w-5 h-5 text-secondary" />
              <span className="text-[14px] font-medium text-on-surface">Sub-second Sync</span>
            </div>
            <p className="text-[12px] text-on-surface-variant border-t border-outline-variant/20 pt-2">
              All inventory updates pass exclusively through transactional row locking with ledger validation.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'forecast' && (
        <div className="space-y-5">
          {intelligenceLoading || forecastLoading ? (
            <div className="p-8 text-center text-on-surface-variant">
              Loading demand analysis…
            </div>
          ) : intelligence && forecastSeries ? (
            <ProductForecastPanel intelligence={intelligence} series={forecastSeries} />
          ) : (
            <div className="p-8 text-center text-on-surface-variant">
              No intelligence data is available for this product.
            </div>
          )}
        </div>
      )}

      {activeTab === 'suppliers' && (
        <DataTable
          columns={supplierColumns}
          data={suppliers || []}
          keyExtractor={(ps) => ps.id}
          emptyTitle="No suppliers linked yet"
          emptyDescription="Link vendor supply chains to enable automated reorder recommendations."
        />
      )}

      {activeTab === 'movements' && (
        <DataTable
          columns={movementColumns}
          data={movementsData?.items || []}
          keyExtractor={(m) => m.id}
          isLoading={movementsLoading}
          emptyTitle="No stock movements recorded"
          emptyDescription="Stock adjustments, receipts, and sales ledger entries for this item will appear here."
          pagination={
            movementsData
              ? {
                  total: movementsData.total,
                  limit: movementLimit,
                  offset: movementOffset,
                  onPageChange: (newOffset) => setMovementOffset(newOffset),
                }
              : undefined
          }
        />
      )}
    </div>
  );
};

interface ProductForecastPanelProps {
  intelligence: ProductIntelligence;
  series: ForecastSeries;
}

const ProductForecastPanel: React.FC<ProductForecastPanelProps> = ({
  intelligence,
  series,
}) => {
  const { forecast, demand_stats, stockout_prediction, reorder_recommendation, risk } =
    intelligence;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          title="Demand Baseline"
          value={`${forecast.daily_demand}/day`}
          subtitle={forecastMethodLabel(forecast.method)}
          icon={TrendingUp}
        />
        <KpiCard
          title="Days to Stockout"
          value={
            stockout_prediction.days_until_stockout === null
              ? '—'
              : String(stockout_prediction.days_until_stockout)
          }
          subtitle={STOCKOUT_LABELS[stockout_prediction.stockout_risk]}
          icon={Clock}
        />
        <KpiCard
          title="Suggested Order"
          value={`${reorder_recommendation.reorder_qty}`}
          subtitle={
            reorder_recommendation.needs_reorder
              ? `MOQ ${reorder_recommendation.min_order_qty} · advisory only`
              : 'No replenishment needed'
          }
          icon={ShoppingCart}
        />
        <div className="rounded-xl bg-surface-container-lowest p-5 border border-outline-variant/30 shadow-xs">
          <span className="font-overline text-[10px] uppercase tracking-wider text-on-surface-variant font-semibold">
            Inventory Risk
          </span>
          <div className="mt-3">
            <RiskBadge category={risk.risk_category} score={risk.risk_score} />
          </div>
          <p className="text-[12px] text-on-surface-variant mt-3">
            {risk.recommended_action}
          </p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-[14px] text-on-surface">
            Recorded daily sales and baseline projection
          </h3>
          <span className="text-[11px] text-on-surface-variant">
            {demand_stats.total_units_sold} units across {demand_stats.observed_sale_days}{' '}
            selling day(s) in {demand_stats.window_days} days
          </span>
        </div>
        <ForecastChart series={series} />
        <p className="text-[12px] text-on-surface-variant">{forecastSourceNote(intelligence)}</p>
        <p className="text-[11px] text-on-surface-variant">
          Rule-based baseline, not machine learning. Projections are a flat rate and do not
          model seasonality, promotions or supplier lead-time variability.
        </p>
      </div>

      <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs space-y-3">
        <h3 className="font-semibold text-[14px] text-on-surface">
          Risk reasoning and reorder explanation
        </h3>
        <ul className="list-disc list-inside text-[12px] text-on-surface-variant space-y-1">
          {risk.reasons.map((reason, idx) => (
            <li key={idx}>{reason}</li>
          ))}
        </ul>
        <ol className="list-decimal list-inside text-[12px] text-on-surface space-y-1 border-t border-outline-variant/20 pt-3">
          {reorder_recommendation.explanation.map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ol>
        <p className="text-[11px] italic text-on-surface-variant">
          {reorder_recommendation.explanation_details.disclaimer}
        </p>
      </div>
    </>
  );
};
