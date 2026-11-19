import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable, Column } from '../components/common/DataTable';
import { api } from '../api/client';
import { formatDateTime, formatSignedDelta } from '../utils/format';
import type { Page, MovementOut } from '../types';

export const MovementHistory: React.FC = () => {
  const [offset, setOffset] = useState(0);
  const [movementType, setMovementType] = useState<string>('');
  const limit = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['movements', movementType, offset],
    queryFn: () =>
      api.get<Page<MovementOut>>('/inventory/movements', {
        movement_type: movementType || undefined,
        limit,
        offset,
      }),
  });

  const columns: Column<MovementOut>[] = [
    {
      header: 'Timestamp',
      accessorKey: 'created_at',
      cell: (m) => formatDateTime(m.created_at),
    },
    {
      header: 'Product',
      accessorKey: 'product_name',
      cell: (m) => (
        <div>
          <span className="font-semibold text-on-surface block">{m.product_name}</span>
          <span className="font-mono text-[11px] text-primary">{m.sku}</span>
        </div>
      ),
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
          {m.reference_type ? `${m.reference_type} #${m.reference_id}` : m.reason || '—'}
        </span>
      ),
    },
    {
      header: 'Recorded By',
      accessorKey: 'user_name',
      cell: (m) => <span className="text-[12px] text-on-surface-variant">{m.user_name}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Movement Ledger"
        subtitle="Cryptographically tamper-evident, append-only history of every inventory fluctuation."
      />

      <div className="rounded-xl bg-surface-container-lowest p-4 border border-outline-variant/30 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-on-surface-variant" />
          <select
            value={movementType}
            onChange={(e) => {
              setMovementType(e.target.value);
              setOffset(0);
            }}
            className="h-9 px-3 rounded-lg border border-outline-variant/40 bg-surface-container-low text-[13px] text-on-surface"
          >
            <option value="">All Movement Types</option>
            <option value="sale">Sale</option>
            <option value="purchase_receipt">Purchase Receipt</option>
            <option value="adjustment">Manual Adjustment</option>
            <option value="sale_reversal">Sale Reversal</option>
            <option value="purchase_reversal">Purchase Reversal</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        keyExtractor={(m) => m.id}
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
    </div>
  );
};
