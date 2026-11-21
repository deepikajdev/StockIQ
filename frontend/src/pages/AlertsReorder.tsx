import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Lightbulb,
  ShieldAlert,
  Truck,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable, Column } from '../components/common/DataTable';
import { Drawer } from '../components/common/Drawer';
import { Modal } from '../components/common/Modal';
import { KpiCard } from '../components/common/KpiCard';
import { RiskBadge } from '../components/intelligence/RiskBadge';
import { intelligenceApi } from '../api/intelligence';
import { formatCurrency } from '../utils/format';
import {
  forecastMethodLabel,
  forecastSourceNote,
  needsSupplierWarning,
  STOCKOUT_LABELS,
} from '../utils/intelligence';
import type { ProductIntelligence, StockoutRisk } from '../types';

type RiskFilter = 'all' | StockoutRisk;

const STOCKOUT_TONES: Record<StockoutRisk, string> = {
  critical: 'bg-rose-100 text-rose-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-emerald-100 text-emerald-800',
  none: 'bg-slate-100 text-slate-600',
};

export const AlertsReorder: React.FC = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<ProductIntelligence | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');

  const {
    data: queue,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['intelligence-reorder-queue'],
    queryFn: () => intelligenceApi.reorderQueue(),
    staleTime: 60_000,
  });

  const { data: summary } = useQuery({
    queryKey: ['intelligence-summary'],
    queryFn: () => intelligenceApi.summary(),
    staleTime: 60_000,
  });

  const items = useMemo(() => {
    const all = queue?.items ?? [];
    return riskFilter === 'all'
      ? all
      : all.filter((i) => i.stockout_prediction.stockout_risk === riskFilter);
  }, [queue, riskFilter]);

  const columns: Column<ProductIntelligence>[] = [
    {
      header: 'SKU / Product',
      accessorKey: 'name',
      cell: (r) => (
        <div>
          <span className="font-semibold text-on-surface block">{r.name}</span>
          <span className="font-mono text-[11px] text-primary">{r.sku}</span>
        </div>
      ),
    },
    {
      header: 'On Hand',
      accessorKey: 'current_stock',
      align: 'right',
      cell: (r) => (
        <span className="font-bold text-rose-700 tabular-nums">
          {r.current_stock} {r.unit}
        </span>
      ),
    },
    {
      header: 'Demand Estimate',
      align: 'right',
      cell: (r) => (
        <div className="text-right">
          <span className="tabular-nums font-mono text-[12px]">
            {r.forecast.daily_demand} / day
          </span>
          {r.forecast.insufficient_history && (
            <span className="block text-[10px] text-amber-700">limited history</span>
          )}
        </div>
      ),
    },
    {
      header: 'Days to Stockout',
      align: 'right',
      cell: (r) => {
        const p = r.stockout_prediction;
        return (
          <span
            className={`inline-flex items-center gap-1 font-semibold tabular-nums px-2 py-0.5 rounded text-[11px] ${STOCKOUT_TONES[p.stockout_risk]}`}
          >
            <AlertTriangle className="w-3 h-3" />
            {p.days_until_stockout === null
              ? STOCKOUT_LABELS[p.stockout_risk]
              : `${p.days_until_stockout} days`}
          </span>
        );
      },
    },
    {
      header: 'Effective Reorder Point',
      align: 'right',
      cell: (r) => (
        <span className="tabular-nums font-mono" title={r.reorder_recommendation.formula}>
          {r.reorder_recommendation.effective_reorder_point}
        </span>
      ),
    },
    {
      header: 'Supplier / Lead Time',
      cell: (r) => {
        const s = r.reorder_recommendation.supplier;
        return s ? (
          <div className="text-[12px]">
            <span className="text-on-surface font-medium">{s.supplier_name}</span>
            <span className="block text-on-surface-variant">
              {s.lead_time_days}d lead · MOQ {s.min_order_qty}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-amber-700">No preferred supplier</span>
        );
      },
    },
    {
      header: 'Suggested Qty',
      align: 'right',
      cell: (r) => (
        <span className="font-bold text-secondary tabular-nums text-[13px]">
          +{r.reorder_recommendation.reorder_qty} units
        </span>
      ),
    },
    {
      header: 'Risk / Logic',
      align: 'center',
      cell: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelected(r);
          }}
          className="h-7 px-2.5 rounded-md border border-outline-variant/40 bg-surface-container-low hover:bg-surface-container text-on-surface text-[11px] font-medium flex items-center gap-1 transition-colors"
        >
          <Info className="w-3.5 h-3.5 text-secondary" />
          <span>Explain</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts & Reorder Intelligence"
        subtitle="Read-only restock signals derived from recorded sales, on-hand stock and supplier lead times."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          title="Needs Replenishment"
          value={summary?.counts.needs_reorder ?? queue?.total ?? 0}
          subtitle="Advisory suggestions only"
          icon={Truck}
        />
        <KpiCard
          title="Critical Inventory Risk"
          value={summary?.counts.critical ?? 0}
          subtitle="Stock below supplier lead time"
          icon={ShieldAlert}
          iconBgColor="bg-rose-50"
          iconColor="text-rose-600"
        />
        <KpiCard
          title="Analysis Window"
          value={`${summary?.window_days ?? 30} days`}
          subtitle={summary?.algorithm.replace(/_/g, ' ') ?? 'Recency-weighted moving average'}
          icon={Lightbulb}
        />
      </div>

      <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex items-start justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-[14px] text-on-surface">
              {items.length} actionable {items.length === 1 ? 'suggestion' : 'suggestions'}
            </h4>
            <p className="text-[12px] text-on-surface-variant mt-0.5 max-w-2xl">
              Demand estimates come from recorded completed sales only. No purchase order is
              created until you review and confirm a draft on the Purchases screen.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-end">
          {(['all', 'critical', 'high', 'medium', 'low'] as RiskFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setRiskFilter(f)}
              className={`h-7 px-2.5 rounded-md text-[11px] font-medium border transition-colors ${
                riskFilter === f
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface-container-low text-on-surface-variant border-outline-variant/40'
              }`}
            >
              {f === 'all' ? 'All' : STOCKOUT_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {isError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[13px]">
          Unable to load intelligence recommendations: {(error as Error)?.message}
        </div>
      )}

      <DataTable
        columns={columns}
        data={items}
        keyExtractor={(r) => r.product_id}
        isLoading={isLoading}
        onRowClick={(r) => setSelected(r)}
        emptyTitle="No suggestions in this risk band"
        emptyDescription="No active product is at or below its effective reorder point for the selected filter."
      />

      {/* Explanation drawer — every recommendation is fully traceable. */}
      <Drawer
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Recommendation Provenance"
        subtitle={`Audit breakdown for SKU: ${selected?.sku}`}
        footer={
          <>
            <button
              onClick={() => setSelected(null)}
              className="h-8 px-3 rounded-lg border border-outline-variant/40 text-[12px]"
            >
              Close
            </button>
            <button
              disabled={!selected || !selected.reorder_recommendation.needs_reorder}
              onClick={() => setConfirmOpen(true)}
              className="h-8 px-3.5 rounded-lg bg-primary text-white font-medium text-[12px] disabled:opacity-40"
            >
              Review draft PO
            </button>
          </>
        }
      >
        {selected && (
          <div className="space-y-4 text-[13px]">
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge
                category={selected.risk.risk_category}
                score={selected.risk.risk_score}
              />
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${STOCKOUT_TONES[selected.stockout_prediction.stockout_risk]}`}>
                {STOCKOUT_LABELS[selected.stockout_prediction.stockout_risk]}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-2">
              <span className="font-overline text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                Demand basis
              </span>
              <div className="font-mono text-[12px] text-primary">
                {forecastMethodLabel(selected.forecast.method)}
              </div>
              <p className="text-[11px] text-on-surface-variant">
                {forecastSourceNote(selected)}
              </p>
              <p className="text-[11px] text-on-surface-variant">
                {selected.demand_stats.total_units_sold} units sold across{' '}
                {selected.demand_stats.observed_sale_days} selling day(s) in the analysis window.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 font-mono text-[11px] text-primary break-words">
              {selected.reorder_recommendation.formula}
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-surface-container-low">
                <span className="block text-on-surface-variant">Sales window</span>
                <span className="font-semibold text-on-surface">
                  {selected.reorder_recommendation.explanation_details.window_start ?? '—'}{' '}
                  →{' '}
                  {selected.reorder_recommendation.explanation_details.window_end ?? '—'} (
                  {selected.reorder_recommendation.explanation_details.lookback_days}d)
                </span>
              </div>
              <div className="p-2 rounded-lg bg-surface-container-low">
                <span className="block text-on-surface-variant">Recorded units sold</span>
                <span className="font-semibold text-on-surface tabular-nums">
                  {selected.reorder_recommendation.explanation_details.units_sold}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-surface-container-low">
                <span className="block text-on-surface-variant">Lead time source</span>
                <span className="font-semibold text-on-surface">
                  {selected.reorder_recommendation.explanation_details.lead_time_source}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-surface-container-low">
                <span className="block text-on-surface-variant">MOQ adjusted</span>
                <span className="font-semibold text-on-surface">
                  {selected.reorder_recommendation.explanation_details.adjusted_for_moq
                    ? 'Yes'
                    : 'No'}
                </span>
              </div>
            </div>
            <p className="text-[11px] italic text-on-surface-variant">
              {selected.reorder_recommendation.explanation_details.disclaimer}
            </p>

            <div className="space-y-2 divide-y divide-outline-variant/20 text-[12px]">
              <div className="flex justify-between py-1.5">
                <span className="text-on-surface-variant">Current on-hand</span>
                <span className="font-semibold tabular-nums text-rose-700">
                  {selected.current_stock} {selected.unit}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-on-surface-variant">Estimated daily demand</span>
                <span className="font-semibold tabular-nums">
                  {selected.forecast.daily_demand} / day
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-on-surface-variant">Supplier lead time</span>
                <span className="font-semibold tabular-nums">
                  {selected.stockout_prediction.lead_time_days} days
                  {selected.stockout_prediction.lead_time_is_assumed && ' (assumed)'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-on-surface-variant">Minimum order quantity</span>
                <span className="font-semibold tabular-nums">
                  {selected.reorder_recommendation.min_order_qty}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-on-surface-variant">Estimated order cost</span>
                <span className="font-semibold tabular-nums">
                  {selected.reorder_recommendation.estimated_order_cost
                    ? formatCurrency(selected.reorder_recommendation.estimated_order_cost)
                    : 'Not available'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 font-bold text-[13px] pt-2">
                <span className="text-on-surface">Suggested replenishment</span>
                <span className="text-secondary tabular-nums">
                  +{selected.reorder_recommendation.reorder_qty} units
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                Step-by-step calculation
              </span>
              <ol className="list-decimal list-inside space-y-1 text-[12px] text-on-surface">
                {selected.reorder_recommendation.explanation.map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
              </ol>
            </div>

            {needsSupplierWarning(selected) && (
              <div className="p-3 rounded-lg bg-amber-50 text-amber-800 text-[11px]">
                No preferred supplier is linked to this product. Link one before creating a
                purchase order; the quantities above use an assumed lead time and MOQ.
              </div>
            )}

            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Deterministic, rule-based calculation — not machine learning. A human must
                confirm any purchase order.
              </span>
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm draft purchase order"
        description={`${selected?.name ?? ''} · ${selected?.sku ?? ''}`}
        footer={
          <>
            <button
              onClick={() => setConfirmOpen(false)}
              className="h-8 px-3 rounded-lg border border-outline-variant/40 text-[12px]"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setConfirmOpen(false);
                setSelected(null);
                navigate('/purchases');
              }}
              className="h-8 px-3.5 rounded-lg bg-primary text-white font-medium text-[12px]"
            >
              Yes, open draft for review
            </button>
          </>
        }
      >
        <p className="text-[13px] text-on-surface">
          This opens the existing Purchases screen with a suggested quantity of{' '}
          <strong>{selected?.reorder_recommendation.reorder_qty ?? 0} units</strong>.
        </p>
        <p className="text-[12px] text-on-surface-variant mt-2">
          Nothing is ordered until you enter the supplier, review the draft and confirm it
          yourself.
        </p>
      </Modal>
    </div>
  );
};
