import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Search,
  Trash2,
  AlertOctagon,
  CheckCircle,
  RotateCcw,
  Receipt,
  Printer,
  ExternalLink,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { QuantityStepper } from '../components/common/QuantityStepper';
import { Modal } from '../components/common/Modal';
import { api, ApiError } from '../api/client';
import { formatCurrency, formatDateTime } from '../utils/format';
import type { Page, Product, Sale, InsufficientStockDetail } from '../types';

interface CartItem {
  product: Product;
  quantity: number;
}

export const NewSale: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [stockError, setStockError] = useState<{
    message: string;
    details?: InsufficientStockDetail;
  } | null>(null);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  const { data: products } = useQuery({
    queryKey: ['pos-products', search],
    queryFn: () =>
      api.get<Page<Product>>('/products', {
        q: search || undefined,
        active: true,
        limit: 15,
      }),
  });

  const addToCart = (product: Product) => {
    setStockError(null);
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, newQty: number) => {
    setStockError(null);
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity: newQty } : item))
    );
  };

  const removeFromCart = (productId: number) => {
    setStockError(null);
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearBasket = () => {
    setStockError(null);
    setCart([]);
  };

  const totalAmount = cart.reduce((acc, item) => {
    return acc + parseFloat(item.product.selling_price) * item.quantity;
  }, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    setStockError(null);

    try {
      const payload = {
        customer_name: customerName.trim() || undefined,
        items: cart.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
        })),
      };

      const result = await api.post<Sale>('/sales', payload);
      setCompletedSale(result);
      setReceiptModalOpen(true);
      toast.success(`Sale #${result.id} completed successfully`);
      setCart([]);
      setCustomerName('');
      queryClient.invalidateQueries({ queryKey: ['pos-products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 409) {
        const detail = err.data as InsufficientStockDetail | undefined;
        setStockError({
          message: err.message || 'Insufficient stock for one or more items.',
          details: detail,
        });
      } else {
        setStockError({
          message: err?.message || 'Transaction could not be completed.',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Point of Sale (POS)"
        subtitle="Fast, atomic order entry with live server-enforced stock validation."
      />

      {/* 409 Insufficient Stock Error Banner */}
      {stockError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 shadow-sm animate-shake">
          <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-[13px] text-rose-900">
              Transaction Blocked: Insufficient Stock
            </h4>
            <p className="text-[12px] text-rose-700 mt-0.5">{stockError.message}</p>
            {stockError.details && (
              <div className="mt-2 text-[11px] font-mono bg-rose-100/70 p-2 rounded border border-rose-300 inline-block">
                <span>Requested: </span>
                <span className="font-bold text-rose-900">{stockError.details.requested} units</span>
                <span> · Available on hand: </span>
                <span className="font-bold text-rose-900">{stockError.details.available} units</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success Notification Banner */}
      {completedSale && !receiptModalOpen && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <h4 className="font-semibold text-[13px] text-emerald-900">
                Order #{completedSale.id} Confirmed
              </h4>
              <p className="text-[12px] text-emerald-700">
                Recorded {formatCurrency(completedSale.total_amount)} across {completedSale.items.length} items.
              </p>
            </div>
          </div>
          <button
            onClick={() => setReceiptModalOpen(true)}
            className="h-8 px-3 rounded-lg border border-emerald-300 bg-white text-emerald-900 text-[12px] font-medium hover:bg-emerald-100/50 flex items-center gap-1.5 transition-colors"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>View Receipt</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Product Selector Grid */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setStockError(null);
              }}
              placeholder="Search products by title or scan SKU barcode..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest text-on-surface text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {products?.items.map((prod) => (
              <div
                key={prod.id}
                onClick={() => addToCart(prod)}
                className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all flex flex-col justify-between group"
              >
                <div>
                  <span className="font-mono text-[10px] text-primary block truncate">
                    {prod.sku}
                  </span>
                  <span className="font-semibold text-[13px] text-on-surface line-clamp-2 mt-0.5 group-hover:text-primary transition-colors">
                    {prod.name}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-outline-variant/20 pt-2">
                  <span className="text-[14px] font-bold text-on-surface tabular-nums">
                    {formatCurrency(prod.selling_price)}
                  </span>
                  <span
                    className={`text-[11px] font-medium ${
                      prod.stock_on_hand <= prod.reorder_point
                        ? 'text-amber-700'
                        : 'text-on-surface-variant'
                    }`}
                  >
                    {prod.stock_on_hand} {prod.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Checkout Basket */}
        <div className="lg:col-span-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 p-5 flex flex-col justify-between shadow-xs min-h-[520px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20 mb-4">
              <span className="font-section-title text-[16px] font-semibold text-on-surface">
                Current Basket ({cart.length})
              </span>
              {cart.length > 0 && (
                <button
                  onClick={clearBasket}
                  className="text-[11px] text-rose-600 hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-[11px] font-medium text-on-surface mb-1">
                Customer Name (Optional)
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Walk-in Customer"
                className="w-full h-8 px-2.5 rounded-lg border border-outline-variant/30 bg-surface-container-low text-[12px]"
              />
            </div>

            {/* Cart Items List */}
            <div className="space-y-3 overflow-y-auto max-h-[260px] pr-1">
              {cart.map((item) => (
                <div
                  key={item.product.id}
                  className="p-2.5 rounded-lg bg-surface-container-low/60 border border-outline-variant/20 flex items-center justify-between gap-2"
                >
                  <div className="truncate flex-1">
                    <span className="font-semibold text-[12px] text-on-surface block truncate">
                      {item.product.name}
                    </span>
                    <span className="text-[10px] text-on-surface-variant font-mono">
                      {formatCurrency(item.product.selling_price)} / {item.product.unit}
                    </span>
                  </div>

                  <QuantityStepper
                    value={item.quantity}
                    onChange={(q) => updateQuantity(item.product.id, q)}
                  />

                  <div className="text-right shrink-0 w-16">
                    <span className="font-semibold text-[13px] tabular-nums text-on-surface block">
                      {formatCurrency(parseFloat(item.product.selling_price) * item.quantity)}
                    </span>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="p-1 text-on-surface-variant hover:text-rose-600 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {cart.length === 0 && (
                <div className="py-12 text-center text-caption text-on-surface-variant">
                  Select products from the catalog to build an order.
                </div>
              )}
            </div>
          </div>

          {/* Checkout Totals & Button */}
          <div className="border-t border-outline-variant/20 pt-4 space-y-3">
            <div className="flex justify-between text-[13px] text-on-surface-variant">
              <span>Subtotal</span>
              <span className="tabular-nums font-medium text-on-surface">{formatCurrency(totalAmount)}</span>
            </div>
            <div className="flex justify-between text-[15px] font-bold text-on-surface pt-1 border-t border-outline-variant/20">
              <span>Total Payable</span>
              <span className="tabular-nums text-primary text-[18px]">{formatCurrency(totalAmount)}</span>
            </div>

            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || submitting}
              className="w-full h-11 rounded-xl bg-primary text-white font-body-medium text-[14px] font-semibold hover:bg-primary/95 transition-all shadow-sm disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {submitting ? 'Processing Transaction...' : `Complete Sale (${formatCurrency(totalAmount)})`}
            </button>
          </div>
        </div>
      </div>

      {/* Sale Receipt Modal */}
      <Modal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        title={`Sales Receipt #SALE-${completedSale?.id}`}
        description={`Customer: ${completedSale?.customer_name || 'Walk-in'} · Date: ${
          completedSale?.sold_at ? formatDateTime(completedSale.sold_at) : 'Just now'
        }`}
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => window.print()}
              className="h-8 px-3 rounded-lg border border-outline-variant/40 text-[12px] flex items-center gap-1.5 hover:bg-surface-container"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setReceiptModalOpen(false);
                  navigate('/sales');
                }}
                className="h-8 px-3 rounded-lg border border-outline-variant/40 text-[12px] flex items-center gap-1 hover:bg-surface-container"
              >
                <span>Sales Ledger</span>
                <ExternalLink className="w-3 h-3" />
              </button>
              <button
                onClick={() => setReceiptModalOpen(false)}
                className="h-8 px-4 rounded-lg bg-primary text-white font-medium text-[12px] hover:bg-primary/90"
              >
                Start Next Sale
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-[13px]">
          <table className="w-full text-left text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 text-overline uppercase text-on-surface-variant">
                <th className="py-2">Item</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Rate</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {completedSale?.items.map((it) => (
                <tr key={it.id}>
                  <td className="py-2 font-medium">
                    <div>{it.product_name}</div>
                    <div className="text-[10px] font-mono text-primary">{it.sku}</div>
                  </td>
                  <td className="py-2 text-right tabular-nums">{it.quantity}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(it.unit_price)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums">
                    {formatCurrency(parseFloat(it.unit_price) * it.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between items-center pt-3 border-t border-outline-variant/30 text-[15px] font-bold">
            <span>Total Paid</span>
            <span className="text-primary">{formatCurrency(completedSale?.total_amount)}</span>
          </div>
        </div>
      </Modal>
    </div>
  );
};
