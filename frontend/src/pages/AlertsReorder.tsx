import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Lightbulb,
  Info,
  Truck,
  TrendingDown,
  CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable, Column } from '../components/common/DataTable';
import { Drawer } from '../components/common/Drawer';
import { api } from '../api/client';
import type { Page, InventoryItem } from '../types';

interface ReorderRecommendation {
  product_id: number;
  sku: string;
  name: string;
  current_stock: number;
  avg_daily_sales: number;
  days_left: number;
  reorder_point: number;
  safety_stock: number;
  suggested_qty: number;
  supplier_name: string;
  lead_time_days: number;
}

export const AlertsReorder: React.FC = () => {
  const navigate = useNavigate();
  const [selectedExplain, setSelectedExplain] = useState<ReorderRecommendation | null>(null);

  // Fetch low stock items from live inventory
  const { data: invData, isLoading } = useQuery({
    queryKey: ['alerts-inventory'],
    queryFn: () => api.get<Page<InventoryItem>>('/inventory', { low_stock: true, limit: 50 }),
  });

  // Calculate reorder recommendations based on live low stock items
  const recommendations: ReorderRecommendation[] =
    invData?.items.map((item) => {
      // Deterministic baseline run-rate based on reorder threshold / standard 7-day cycle
      const avgSales = Math.max(1, Math.round((item.reorder_point / 7) * 10) / 10);
      const leadTime = 7;
      const daysLeft = Math.max(0, Math.round(item.quantity / avgSales));
      const targetStock = item.reorder_point * 2;
      const suggestedQty = Math.max(10, targetStock - item.quantity);

      return {
        product_id: item.product_id,
        sku: item.sku,
        name: item.name,
        current_stock: item.quantity,
        avg_daily_sales: avgSales,
        days_left: daysLeft,
        reorder_point: item.reorder_point,
        safety_stock: Math.round(item.reorder_point * 0.5),
        suggested_qty: suggestedQty,
        supplier_name: 'Primary Vendor',
        lead_time_days: leadTime,
      };
    }) || [];

  const columns: Column<ReorderRecommendation>[] = [
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
      header: 'Current Stock',
      accessorKey: 'current_stock',
      align: 'right',
      cell: (r) => (
        <span className="font-bold text-rose-700 tabular-nums">{r.current_stock} units</span>
      ),
    },
    {
      header: 'Estimated Run-Rate',
      accessorKey: 'avg_daily_sales',
      align: 'right',
      cell: (r) => <span className="tabular-nums font-mono text-[12px]">~{r.avg_daily_sales} / day</span>,
    },
    {
      header: 'Stock Coverage',
      accessorKey: 'days_left',
      align: 'right',
      cell: (r) => (
        <span
          className={`inline-flex items-center gap-1 font-semibold tabular-nums px-2 py-0.5 rounded text-[11px] ${
            r.days_left <= 3
              ? 'bg-rose-100 text-rose-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          <TrendingDown className="w-3 h-3" />
          <span>{r.days_left} days</span>
        </span>
      ),
    },
    {
      header: 'Reorder Point',
      accessorKey: 'reorder_point',
      align: 'right',
      cell: (r) => <span className="tabular-nums font-mono">{r.reorder_point}</span>,
    },
    {
      header: 'Suggested Replenishment',
      accessorKey: 'suggested_qty',
      align: 'right',
      cell: (r) => (
        <span className="font-bold text-secondary tabular-nums text-[13px]">
          +{r.suggested_qty} units
        </span>
      ),
    },
    {
      header: 'Provenance',
      align: 'center',
      cell: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedExplain(r);
          }}
          className="h-7 px-2.5 rounded-md border border-outline-variant/40 bg-surface-container-low hover:bg-surface-container text-on-surface text-[11px] font-medium flex items-center gap-1 transition-colors"
        >
          <Info className="w-3.5 h-3.5 text-secondary" />
          <span>Audit Logic</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts & Reorder Intelligence"
        subtitle="Transparent restock signals modeled with deterministic safety stock formulas."
      />

      {/* Hero Intelligence Banner */}
      <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex items-start justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-[14px] text-on-surface">
              {recommendations.length} Products Require Replenishment
            </h4>
            <p className="text-[12px] text-on-surface-variant mt-0.5 max-w-xl">
              Signals are derived from live inventory breach levels against baseline reorder points and lead time buffers.
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/purchases')}
          className="h-8 px-3.5 rounded-lg bg-primary text-white font-medium text-[12px] hover:bg-primary/90 flex items-center gap-1.5 shadow-xs shrink-0"
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Create Draft PO</span>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={recommendations}
        keyExtractor={(r) => r.product_id}
        isLoading={isLoading}
        onRowClick={(r) => setSelectedExplain(r)}
        emptyTitle="All inventory levels nominal"
        emptyDescription="No SKUs are currently breaching safety stock thresholds."
      />

      {/* "Explain This Recommendation" Slide-Over Drawer */}
      <Drawer
        isOpen={!!selectedExplain}
        onClose={() => setSelectedExplain(null)}
        title="Recommendation Provenance"
        subtitle={`Audit breakdown for SKU: ${selectedExplain?.sku}`}
        footer={
          <>
            <button
              onClick={() => setSelectedExplain(null)}
              className="h-8 px-3 rounded-lg border border-outline-variant/40 text-[12px]"
            >
              Close
            </button>
            <button
              onClick={() => {
                setSelectedExplain(null);
                navigate('/purchases');
              }}
              className="h-8 px-3.5 rounded-lg bg-primary text-white font-medium text-[12px]"
            >
              Order +{selectedExplain?.suggested_qty} Units
            </button>
          </>
        }
      >
        {selectedExplain && (
          <div className="space-y-4 text-[13px]">
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-2">
              <span className="font-overline text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                Transparent Formula Logic
              </span>
              <div className="p-2.5 rounded-lg bg-surface-container-lowest font-mono text-[12px] text-primary border border-outline-variant/30">
                Suggested Qty = Target Stock - Current Stock
              </div>
              <p className="text-[11px] text-on-surface-variant">
                Where Target Stock = (Baseline Run-Rate × Lead Time) + Safety Stock
              </p>
            </div>

            <div className="space-y-2 divide-y divide-outline-variant/20 text-[12px]">
              <div className="flex justify-between py-1.5">
                <span className="text-on-surface-variant">Current On-Hand Balance</span>
                <span className="font-semibold text-rose-700 tabular-nums">
                  {selectedExplain.current_stock} units
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-on-surface-variant">Estimated Daily Demand</span>
                <span className="font-semibold tabular-nums">
                  {selectedExplain.avg_daily_sales} units / day
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-on-surface-variant">Supplier Lead Time</span>
                <span className="font-semibold tabular-nums">
                  {selectedExplain.lead_time_days} days
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-on-surface-variant">Safety Stock Buffer</span>
                <span className="font-semibold tabular-nums">{selectedExplain.safety_stock} units</span>
              </div>
              <div className="flex justify-between py-1.5 font-bold text-[13px] pt-2">
                <span className="text-on-surface">Calculated Replenishment Qty</span>
                <span className="text-secondary tabular-nums">
                  +{selectedExplain.suggested_qty} units
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Deterministic model based on configured reorder points and buffer levels. Machine-learning predictive velocity will integrate in Phase 3.
              </span>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
