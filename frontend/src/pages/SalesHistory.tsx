import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ban, Eye } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import { formatCurrency, formatDateTime } from '../utils/format';
import type { Page, Sale } from '../types';

export const SalesHistory: React.FC = () => {
  const { isAdmin } = useAuth();
  const [offset, setOffset] = useState(0);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [cancelModalSale, setCancelModalSale] = useState<Sale | null>(null);
  const limit = 25;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sales', offset],
    queryFn: () => api.get<Page<Sale>>('/sales', { limit, offset }),
  });

  const handleCancelSale = async () => {
    if (!cancelModalSale) return;
    try {
      await api.post(`/sales/${cancelModalSale.id}/cancel`);
      setCancelModalSale(null);
      refetch();
    } catch (err: any) {
      alert(err?.message || 'Failed to cancel sale.');
    }
  };

  const columns: Column<Sale>[] = [
    {
      header: 'Order #',
      accessorKey: 'id',
      cell: (s) => <span className="font-mono font-semibold text-primary">#{s.id}</span>,
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
      header: 'Items',
      cell: (s) => <span>{s.items?.length || 0} line items</span>,
    },
    {
      header: 'Total Amount',
      accessorKey: 'total_amount',
      align: 'right',
      cell: (s) => (
        <span className="font-bold tabular-nums text-on-surface">
          {formatCurrency(s.total_amount)}
        </span>
      ),
    },
    {
      header: 'Status',
      align: 'center',
      cell: (s) => <StatusBadge status={s.status} />,
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (s) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setSelectedSale(s)}
            title="Inspect Order Items"
            className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container"
          >
            <Eye className="w-4 h-4" />
          </button>
          {isAdmin && s.status === 'completed' && (
            <button
              onClick={() => setCancelModalSale(s)}
              title="Cancel Sale & Revert Stock"
              className="p-1 rounded text-on-surface-variant hover:text-rose-600 hover:bg-rose-50"
            >
              <Ban className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Ledger & Order History"
        subtitle="Complete record of all POS checkouts and atomic inventory stock decrements."
      />

      <DataTable
        columns={columns}
        data={data?.items || []}
        keyExtractor={(s) => s.id}
        isLoading={isLoading}
        onRowClick={(s) => setSelectedSale(s)}
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

      {/* View Items Modal */}
      <Modal
        isOpen={!!selectedSale}
        onClose={() => setSelectedSale(null)}
        title={`Order Details #${selectedSale?.id}`}
        description={`Sold on ${formatDateTime(selectedSale?.sold_at)} · Customer: ${
          selectedSale?.customer_name || 'Walk-in'
        }`}
      >
        <div className="space-y-3">
          <table className="w-full text-left text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 text-overline uppercase text-on-surface-variant">
                <th className="py-2">SKU</th>
                <th className="py-2">Item</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Unit Price</th>
                <th className="py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {selectedSale?.items.map((i) => (
                <tr key={i.id}>
                  <td className="py-2 font-mono text-primary">{i.sku}</td>
                  <td className="py-2 font-medium">{i.product_name}</td>
                  <td className="py-2 text-right tabular-nums">{i.quantity}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(i.unit_price)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums">
                    {formatCurrency(parseFloat(i.unit_price) * i.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between items-center pt-3 border-t border-outline-variant/30 text-[14px] font-bold">
            <span>Total Amount Paid</span>
            <span className="text-primary">{formatCurrency(selectedSale?.total_amount)}</span>
          </div>
        </div>
      </Modal>

      {/* Cancel Sale Modal */}
      <Modal
        isOpen={!!cancelModalSale}
        onClose={() => setCancelModalSale(null)}
        title={`Cancel Order #${cancelModalSale?.id}`}
        description="Cancelling will write new reversal ledger entries and restore stock."
        footer={
          <>
            <button
              onClick={() => setCancelModalSale(null)}
              className="h-8 px-3 rounded-lg border border-outline-variant/40 text-on-surface text-[12px]"
            >
              Keep Order
            </button>
            <button
              onClick={handleCancelSale}
              className="h-8 px-3.5 rounded-lg bg-rose-600 text-white font-medium text-[12px]"
            >
              Confirm Cancellation
            </button>
          </>
        }
      >
        <p className="text-[13px] text-on-surface-variant">
          This will append a <code>sale_reversal</code> entry for every line item in this order.
        </p>
      </Modal>
    </div>
  );
};
