import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { SlidersHorizontal, Search, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../hooks/useAuth';
import { api, ApiError } from '../api/client';
import { formatCurrency } from '../utils/format';
import type { Page, InventoryItem, AdjustReason } from '../types';

const adjustmentSchema = z.object({
  product_id: z.coerce.number({ invalid_type_error: 'Please select a product' }).min(1, 'Product is required'),
  quantity_change: z.coerce
    .number({ invalid_type_error: 'Must be a valid integer' })
    .refine((val) => val !== 0, 'Quantity change must not be zero'),
  reason: z.enum(['correction', 'damaged', 'lost', 'found', 'opening_balance', 'other'] as const),
  note: z.string().optional(),
});

type AdjustmentFormData = z.infer<typeof adjustmentSchema>;

export const Inventory: React.FC = () => {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 25;

  // Adjustment Modal State
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdjustmentFormData>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      reason: 'correction',
      note: '',
    },
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['inventory', search, lowStockOnly, offset],
    queryFn: () =>
      api.get<Page<InventoryItem>>('/inventory', {
        q: search || undefined,
        low_stock: lowStockOnly || undefined,
        limit,
        offset,
      }),
  });

  const onSubmitAdjustment = async (formData: AdjustmentFormData) => {
    setAdjustError(null);
    setSubmitting(true);

    try {
      await api.post('/inventory/adjustments', {
        product_id: formData.product_id,
        quantity_change: formData.quantity_change,
        reason: formData.reason as AdjustReason,
        note: formData.note || undefined,
      });
      toast.success('Stock adjustment committed to the ledger');
      setAdjustModalOpen(false);
      reset({ reason: 'correction', note: '' });
      refetch();
    } catch (err: any) {
      if (err instanceof ApiError) {
        setAdjustError(err.message);
      } else {
        setAdjustError(err?.message || 'Failed to apply stock adjustment.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openAdjustModal = () => {
    setAdjustError(null);
    reset({ reason: 'correction', note: '' });
    setAdjustModalOpen(true);
  };

  const columns: Column<InventoryItem>[] = [
    {
      header: 'SKU',
      accessorKey: 'sku',
      className: 'font-mono text-primary font-semibold text-[12px]',
    },
    {
      header: 'Product Name',
      accessorKey: 'name',
      cell: (item) => (
        <div>
          <span className="font-semibold text-on-surface block">{item.name}</span>
          <span className="text-[11px] text-on-surface-variant">{item.category_name || 'General'}</span>
        </div>
      ),
    },
    {
      header: 'Warehouse',
      accessorKey: 'warehouse_name',
    },
    {
      header: 'Quantity on Hand',
      accessorKey: 'quantity',
      align: 'right',
      cell: (item) => (
        <span
          className={`font-semibold text-[14px] ${
            item.quantity <= item.reorder_point ? 'text-amber-700' : 'text-on-surface'
          }`}
        >
          {item.quantity} {item.unit}
        </span>
      ),
    },
    {
      header: 'Cost Price',
      accessorKey: 'cost_price',
      align: 'right',
      cell: (item) => formatCurrency(item.cost_price),
    },
    {
      header: 'Stock Value',
      accessorKey: 'stock_value',
      align: 'right',
      cell: (item) => (
        <span className="font-semibold text-emerald-800 tabular-nums">
          {formatCurrency(item.stock_value)}
        </span>
      ),
    },
    {
      header: 'Reorder Point',
      accessorKey: 'reorder_point',
      align: 'right',
    },
    {
      header: 'Stock Status',
      align: 'center',
      cell: (item) => (
        <StatusBadge
          status={
            item.quantity <= 0
              ? 'out_of_stock'
              : item.quantity <= item.reorder_point
              ? 'low_stock'
              : 'in_stock'
          }
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Balances"
        subtitle="On-hand stock levels and live valuation verified against the append-only ledger."
        actions={
          isAdmin && (
            <button
              onClick={openAdjustModal}
              className="h-9 px-4 rounded-lg bg-primary text-white font-medium text-[13px] hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Adjust Stock</span>
            </button>
          )
        }
      />

      {/* Filter and Search Bar */}
      <div className="rounded-xl bg-surface-container-lowest p-4 border border-outline-variant/30 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
              placeholder="Search by SKU, product name..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-outline-variant/40 bg-surface-container-low text-on-surface text-[13px] focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setLowStockOnly(!lowStockOnly);
              setOffset(0);
            }}
            className={`h-9 px-3 rounded-lg border text-[12px] font-medium transition-colors flex items-center gap-1.5 ${
              lowStockOnly
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'border-outline-variant/40 bg-surface-container-low text-on-surface hover:bg-surface-container'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Low Stock Alert Filter</span>
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <DataTable
        columns={columns}
        data={data?.items || []}
        keyExtractor={(item) => item.product_id}
        isLoading={isLoading}
        pagination={
          data
            ? {
                total: data.total,
                limit,
                offset,
                onPageChange: (newOffset) => setOffset(newOffset),
              }
            : undefined
        }
      />

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        title="Adjust Inventory Stock"
        description="Records a verified transaction in the append-only stock movement ledger."
      >
        <form onSubmit={handleSubmit(onSubmitAdjustment)} className="space-y-4 text-[13px]">
          {adjustError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[12px]">
              {adjustError}
            </div>
          )}

          <div>
            <label className="block font-medium text-on-surface mb-1">Select Product *</label>
            <select
              {...register('product_id')}
              className={`w-full h-9 px-3 rounded-lg border bg-surface-container-low text-on-surface ${
                errors.product_id ? 'border-rose-500' : 'border-outline-variant/40'
              }`}
            >
              <option value="">Choose an SKU...</option>
              {data?.items.map((i) => (
                <option key={i.product_id} value={i.product_id}>
                  {i.sku} — {i.name} (Current: {i.quantity} {i.unit})
                </option>
              ))}
            </select>
            {errors.product_id && (
              <p className="mt-1 text-[11px] text-rose-600">{errors.product_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-on-surface mb-1">
                Quantity Change (+/-) *
              </label>
              <input
                type="number"
                {...register('quantity_change')}
                placeholder="e.g. +10 or -3"
                className={`w-full h-9 px-3 rounded-lg border bg-surface-container-low font-mono ${
                  errors.quantity_change ? 'border-rose-500' : 'border-outline-variant/40'
                }`}
              />
              {errors.quantity_change && (
                <p className="mt-1 text-[11px] text-rose-600">{errors.quantity_change.message}</p>
              )}
            </div>
            <div>
              <label className="block font-medium text-on-surface mb-1">Reason *</label>
              <select
                {...register('reason')}
                className="w-full h-9 px-3 rounded-lg border border-outline-variant/40 bg-surface-container-low text-on-surface"
              >
                <option value="correction">Correction</option>
                <option value="damaged">Damaged Goods</option>
                <option value="lost">Lost / Shrinkage</option>
                <option value="found">Found Item</option>
                <option value="opening_balance">Opening Balance</option>
                <option value="other">Other</option>
              </select>
              {errors.reason && (
                <p className="mt-1 text-[11px] text-rose-600">{errors.reason.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block font-medium text-on-surface mb-1">Audit Note (Optional)</label>
            <input
              type="text"
              {...register('note')}
              placeholder="e.g. Annual stock audit reconciliation"
              className="w-full h-9 px-3 rounded-lg border border-outline-variant/40 bg-surface-container-low"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/30">
            <button
              type="button"
              onClick={() => setAdjustModalOpen(false)}
              className="h-8 px-3 rounded-lg border border-outline-variant/40 text-on-surface text-[12px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-8 px-4 rounded-lg bg-primary text-white font-medium text-[12px] hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? 'Committing...' : 'Commit Adjustment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
