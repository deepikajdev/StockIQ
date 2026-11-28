import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, CheckCircle, Eye, Trash2, XCircle } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { Drawer } from '../components/common/Drawer';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../hooks/useAuth';
import { api, ApiError } from '../api/client';
import { formatCurrency, formatDateTime } from '../utils/format';
import {
  canCreatePurchase,
  canEditPurchase,
  canReceivePurchase,
} from '../utils/purchaseRbac';
import type { Page, Purchase, Supplier, Product } from '../types';

interface NewPOItem {
  product_id: number;
  quantity: number;
  unit_cost: string;
}

export const Purchases: React.FC = () => {
  const { user } = useAuth();
  const purchaseRole = user?.role;
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [isNewDrawerOpen, setIsNewDrawerOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New PO State
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [receiveNow, setReceiveNow] = useState(false);
  const [poItems, setPoItems] = useState<NewPOItem[]>([
    { product_id: 0, quantity: 1, unit_cost: '0.00' },
  ]);

  const limit = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['purchases', offset],
    queryFn: () => api.get<Page<Purchase>>('/purchases', { limit, offset }),
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => api.get<Page<Supplier>>('/suppliers', { limit: 100 }),
  });

  const { data: products } = useQuery({
    queryKey: ['products-for-po'],
    queryFn: () => api.get<Page<Product>>('/products', { limit: 200, active: true }),
  });

  const handleReceive = async (purchaseId: number) => {
    try {
      await api.post(`/purchases/${purchaseId}/receive`);
      toast.success(`PO #${purchaseId} received into inventory ledger`);
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (selectedPurchase?.id === purchaseId) {
        setSelectedPurchase(null);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to receive purchase order.');
    }
  };

  const handleCancel = async (purchaseId: number) => {
    if (!window.confirm(`Are you sure you want to cancel PO #${purchaseId}?`)) return;
    try {
      await api.post(`/purchases/${purchaseId}/cancel`);
      toast.success(`PO #${purchaseId} cancelled`);
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      if (selectedPurchase?.id === purchaseId) {
        setSelectedPurchase(null);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel purchase order.');
    }
  };

  const handleAddItemRow = () => {
    setPoItems((prev) => [...prev, { product_id: 0, quantity: 1, unit_cost: '0.00' }]);
  };

  const handleRemoveItemRow = (index: number) => {
    setPoItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof NewPOItem, value: any) => {
    setPoItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        if (field === 'product_id') {
          const selected = products?.items.find((p) => p.id === Number(value));
          if (selected) {
            updated.unit_cost = selected.cost_price;
          }
        }
        return updated;
      })
    );
  };

  const poTotalCost = poItems.reduce((acc, it) => {
    const cost = parseFloat(it.unit_cost) || 0;
    return acc + cost * (it.quantity || 0);
  }, 0);

  const resetDrawer = () => {
    setSupplierId('');
    setNotes('');
    setReceiveNow(false);
    setPoItems([{ product_id: 0, quantity: 1, unit_cost: '0.00' }]);
    setFormError(null);
  };

  const handleSubmitPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      setFormError('Please select a supplier.');
      return;
    }
    const validItems = poItems.filter((i) => i.product_id > 0 && i.quantity > 0);
    if (validItems.length === 0) {
      setFormError('Please add at least one product with quantity > 0.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        supplier_id: Number(supplierId),
        items: validItems.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_cost: i.unit_cost,
        })),
        notes: notes.trim() || undefined,
        receive_now: receiveNow,
      };

      const res = await api.post<Purchase>('/purchases', payload);
      toast.success(
        receiveNow
          ? `PO #${res.id} created and received into inventory`
          : `PO #${res.id} created as draft`
      );
      setIsNewDrawerOpen(false);
      resetDrawer();
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err: any) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError(err?.message || 'Failed to create purchase order.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<Purchase>[] = [
    {
      header: 'PO Number',
      accessorKey: 'id',
      cell: (p) => <span className="font-mono font-semibold text-primary">PO-{p.id}</span>,
    },
    {
      header: 'Supplier',
      accessorKey: 'supplier_name',
      cell: (p) => <span className="font-semibold text-on-surface">{p.supplier_name}</span>,
    },
    {
      header: 'Order Date',
      accessorKey: 'order_date',
      cell: (p) => formatDateTime(p.order_date),
    },
    {
      header: 'Received At',
      accessorKey: 'received_at',
      cell: (p) => (p.received_at ? formatDateTime(p.received_at) : '—'),
    },
    {
      header: 'Total Cost',
      accessorKey: 'total_cost',
      align: 'right',
      cell: (p) => (
        <span className="font-bold tabular-nums text-on-surface">
          {formatCurrency(p.total_cost)}
        </span>
      ),
    },
    {
      header: 'Status',
      align: 'center',
      cell: (p) => <StatusBadge status={p.status} />,
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (p) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setSelectedPurchase(p)}
            title="View Details"
            className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container"
          >
            <Eye className="w-4 h-4" />
          </button>
          {p.status === 'draft' && canReceivePurchase(purchaseRole) && (
            <>
              <button
                onClick={() => handleReceive(p.id)}
                title="Receive Goods"
                className="h-7 px-2.5 rounded-md bg-emerald-600 text-white font-medium text-[11px] flex items-center gap-1 hover:bg-emerald-700 transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Receive</span>
              </button>
              {canEditPurchase(purchaseRole) && (
                <button
                  onClick={() => handleCancel(p.id)}
                  title="Cancel PO"
                  className="p-1 text-on-surface-variant hover:text-rose-600 rounded"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders & Replenishment"
        subtitle="Manage inbound vendor shipments, goods receipt verification, and stock additions."
        actions={
          canCreatePurchase(purchaseRole) && (
            <button
              onClick={() => {
                resetDrawer();
                setIsNewDrawerOpen(true);
              }}
              className="h-9 px-4 rounded-lg bg-primary text-white font-medium text-[13px] hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New Purchase Order</span>
            </button>
          )
        }
      />

      <DataTable
        columns={columns}
        data={data?.items || []}
        keyExtractor={(p) => p.id}
        isLoading={isLoading}
        onRowClick={(p) => setSelectedPurchase(p)}
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

      {/* PO Details Modal */}
      <Modal
        isOpen={!!selectedPurchase}
        onClose={() => setSelectedPurchase(null)}
        title={`Purchase Order #PO-${selectedPurchase?.id}`}
        description={`Supplier: ${selectedPurchase?.supplier_name} · Ordered: ${
          selectedPurchase?.order_date ? formatDateTime(selectedPurchase.order_date) : ''
        }`}
        footer={
          selectedPurchase?.status === 'draft' && canReceivePurchase(purchaseRole) ? (
            <div className="flex items-center justify-end gap-2 w-full">
              {canEditPurchase(purchaseRole) && (
                <button
                  onClick={() => selectedPurchase && handleCancel(selectedPurchase.id)}
                  className="h-8 px-3 rounded-lg border border-rose-300 text-rose-700 text-[12px] hover:bg-rose-50"
                >
                  Cancel PO
                </button>
              )}
              <button
                onClick={() => selectedPurchase && handleReceive(selectedPurchase.id)}
                className="h-8 px-4 rounded-lg bg-emerald-600 text-white font-medium text-[12px] flex items-center gap-1.5 hover:bg-emerald-700"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Receive Items into Stock</span>
              </button>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-4">
          <table className="w-full text-left text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 text-overline uppercase text-on-surface-variant">
                <th className="py-2">SKU</th>
                <th className="py-2">Product</th>
                <th className="py-2 text-right">Quantity</th>
                <th className="py-2 text-right">Unit Cost</th>
                <th className="py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {selectedPurchase?.items.map((i) => (
                <tr key={i.id}>
                  <td className="py-2 font-mono text-primary">{i.sku}</td>
                  <td className="py-2 font-medium">{i.product_name}</td>
                  <td className="py-2 text-right tabular-nums">{i.quantity}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(i.unit_cost)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums">
                    {formatCurrency(parseFloat(i.unit_cost) * i.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {selectedPurchase?.notes && (
            <div className="text-[12px] text-on-surface-variant bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/20">
              <span className="font-semibold block text-on-surface">Notes:</span>
              {selectedPurchase.notes}
            </div>
          )}

          <div className="flex justify-between items-center pt-3 border-t border-outline-variant/30 text-[14px] font-bold">
            <span>Total Inbound Cost</span>
            <span className="text-primary">{formatCurrency(selectedPurchase?.total_cost)}</span>
          </div>
        </div>
      </Modal>

      {/* New Purchase Drawer */}
      <Drawer
        isOpen={canCreatePurchase(purchaseRole) && isNewDrawerOpen}
        onClose={() => setIsNewDrawerOpen(false)}
        title="Draft Purchase Order"
        subtitle="Specify vendor, line items, and cost allocations."
      >
        <form onSubmit={handleSubmitPO} className="space-y-4 text-[13px]">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[12px]">
              {formError}
            </div>
          )}

          <div>
            <label className="block font-medium text-on-surface mb-1">Select Supplier *</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}
              required
              className="w-full h-9 px-3 rounded-lg border border-outline-variant/40 bg-surface-container-low text-on-surface"
            >
              <option value="">Choose vendor...</option>
              {suppliers?.items.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.contact_name ? `(${s.contact_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-medium text-on-surface">Order Line Items *</label>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-[12px] text-primary hover:underline flex items-center gap-1 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {poItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low/70 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={item.product_id}
                      onChange={(e) =>
                        handleItemChange(idx, 'product_id', Number(e.target.value))
                      }
                      className="flex-1 h-8 px-2 rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-[12px]"
                    >
                      <option value={0}>Choose product...</option>
                      {products?.items.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.sku} — {prod.name}
                        </option>
                      ))}
                    </select>

                    {poItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        className="p-1 text-on-surface-variant hover:text-rose-600 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-on-surface-variant mb-0.5">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          handleItemChange(
                            idx,
                            'quantity',
                            Math.max(1, parseInt(e.target.value, 10) || 1)
                          )
                        }
                        className="w-full h-8 px-2 rounded-lg border border-outline-variant/40 bg-surface-container-lowest font-mono text-[12px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-on-surface-variant mb-0.5">
                        Unit Cost (₹)
                      </label>
                      <input
                        type="text"
                        value={item.unit_cost}
                        onChange={(e) => handleItemChange(idx, 'unit_cost', e.target.value)}
                        placeholder="0.00"
                        className="w-full h-8 px-2 rounded-lg border border-outline-variant/40 bg-surface-container-lowest font-mono text-[12px]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-medium text-on-surface mb-1">Order Notes (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Standard monthly stationery replenishment"
              className="w-full p-2.5 rounded-lg border border-outline-variant/40 bg-surface-container-low text-[12px]"
            />
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-surface-container-low border border-outline-variant/20">
            <input
              type="checkbox"
              id="receiveNow"
              checked={receiveNow}
              onChange={(e) => setReceiveNow(e.target.checked)}
              className="rounded text-primary focus:ring-primary w-4 h-4"
            />
            <label htmlFor="receiveNow" className="text-[12px] font-medium text-on-surface cursor-pointer">
              Mark as Received Immediately (Auto-update stock balance)
            </label>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-outline-variant/30 text-[14px] font-bold">
            <span>Estimated Total</span>
            <span className="text-primary">{formatCurrency(poTotalCost)}</span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsNewDrawerOpen(false)}
              className="h-8 px-3 rounded-lg border border-outline-variant/40 text-[12px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-8 px-4 rounded-lg bg-primary text-white font-medium text-[12px] hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? 'Creating PO...' : receiveNow ? 'Create & Receive' : 'Save Draft PO'}
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
};
