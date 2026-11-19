import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Plus, Search, Mail, Phone, MapPin, Eye, Edit, Package } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { Drawer } from '../components/common/Drawer';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../hooks/useAuth';
import { api, ApiError } from '../api/client';
import { formatCurrency } from '../utils/format';
import type { Page, Supplier } from '../types';

interface SupplierProduct {
  product_id: number;
  sku: string;
  name: string;
  unit_cost: string | null;
  lead_time_days: number | null;
  min_order_qty: number | null;
  is_preferred: boolean;
}

const supplierSchema = z.object({
  name: z.string().min(1, 'Company name is required').max(200),
  contact_name: z.string().max(100).optional().or(z.literal('')),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  address: z.string().max(255).optional().or(z.literal('')),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

export const Suppliers: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const limit = 25;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', search, offset],
    queryFn: () =>
      api.get<Page<Supplier>>('/suppliers', {
        q: search || undefined,
        limit,
        offset,
      }),
  });

  const { data: supplierProducts } = useQuery({
    queryKey: ['supplier-products', selectedSupplier?.id],
    queryFn: () =>
      selectedSupplier
        ? api.get<SupplierProduct[]>(`/suppliers/${selectedSupplier.id}/products`)
        : Promise.resolve([]),
    enabled: !!selectedSupplier,
  });

  const openAddDrawer = () => {
    setEditingSupplier(null);
    setFormError(null);
    reset({
      name: '',
      contact_name: '',
      email: '',
      phone: '',
      address: '',
    });
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (s: Supplier) => {
    setEditingSupplier(s);
    setFormError(null);
    reset({
      name: s.name,
      contact_name: s.contact_name || '',
      email: s.email || '',
      phone: s.phone || '',
      address: s.address || '',
    });
    setIsDrawerOpen(true);
  };

  const onSubmitSupplier = async (values: SupplierFormData) => {
    setSubmitting(true);
    setFormError(null);

    const payload = {
      name: values.name.trim(),
      contact_name: values.contact_name?.trim() || null,
      email: values.email?.trim() || null,
      phone: values.phone?.trim() || null,
      address: values.address?.trim() || null,
    };

    try {
      if (editingSupplier) {
        await api.patch(`/suppliers/${editingSupplier.id}`, payload);
        toast.success(`Supplier "${payload.name}" updated successfully`);
      } else {
        await api.post('/suppliers', payload);
        toast.success(`Supplier "${payload.name}" registered`);
      }
      setIsDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-list'] });
    } catch (err: any) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError(err?.message || 'Operation failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<Supplier>[] = [
    {
      header: 'Supplier Name',
      accessorKey: 'name',
      cell: (s) => (
        <div>
          <span className="font-semibold text-on-surface block">{s.name}</span>
          {s.contact_name && (
            <span className="text-[11px] text-on-surface-variant">Attn: {s.contact_name}</span>
          )}
        </div>
      ),
    },
    {
      header: 'Contact Information',
      cell: (s) => (
        <div className="space-y-0.5 text-[11px] text-on-surface-variant">
          {s.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="w-3 h-3 text-secondary" />
              <span>{s.email}</span>
            </div>
          )}
          {s.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-secondary" />
              <span>{s.phone}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Address',
      accessorKey: 'address',
      cell: (s) => (
        <span className="text-[12px] text-on-surface-variant line-clamp-1">
          {s.address || '—'}
        </span>
      ),
    },
    {
      header: 'Status',
      align: 'center',
      cell: (s) => <StatusBadge status={s.is_active ? 'active' : 'inactive'} />,
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (s) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setSelectedSupplier(s)}
            title="View Details"
            className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container"
          >
            <Eye className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button
              onClick={() => openEditDrawer(s)}
              title="Edit Supplier"
              className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier & Vendor Directory"
        subtitle="Manage wholesale partner contacts, supply chain lead times, and product links."
        actions={
          isAdmin && (
            <button
              onClick={openAddDrawer}
              className="h-9 px-4 rounded-lg bg-primary text-white font-medium text-[13px] hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Supplier</span>
            </button>
          )
        }
      />

      {/* Search Bar */}
      <div className="rounded-xl bg-surface-container-lowest p-4 border border-outline-variant/30 flex items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            placeholder="Search suppliers by title or contact person..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-outline-variant/40 bg-surface-container-low text-on-surface text-[13px] focus:outline-none"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        keyExtractor={(s) => s.id}
        isLoading={isLoading}
        onRowClick={(s) => setSelectedSupplier(s)}
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

      {/* Supplier Detail Modal */}
      <Modal
        isOpen={!!selectedSupplier}
        onClose={() => setSelectedSupplier(null)}
        title={selectedSupplier?.name || 'Supplier'}
        description={`Contact: ${selectedSupplier?.contact_name || 'N/A'}`}
        footer={
          isAdmin ? (
            <div className="flex justify-end w-full">
              <button
                onClick={() => {
                  const s = selectedSupplier;
                  setSelectedSupplier(null);
                  if (s) openEditDrawer(s);
                }}
                className="h-8 px-3 rounded-lg bg-primary text-white font-medium text-[12px] flex items-center gap-1 hover:bg-primary/90"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Supplier</span>
              </button>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-4 text-[13px]">
          <div className="p-3 rounded-lg bg-surface-container-low space-y-1.5">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <span>{selectedSupplier?.email || 'No email provided'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" />
              <span>{selectedSupplier?.phone || 'No phone number'}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <span>{selectedSupplier?.address || 'No address provided'}</span>
            </div>
          </div>

          <div>
            <h5 className="font-semibold text-on-surface mb-2 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-primary" />
              <span>Linked Products ({supplierProducts?.length || 0})</span>
            </h5>
            {supplierProducts && supplierProducts.length > 0 ? (
              <div className="divide-y divide-outline-variant/20 border border-outline-variant/30 rounded-lg max-h-[200px] overflow-y-auto">
                {supplierProducts.map((p) => (
                  <div key={p.product_id} className="p-2.5 flex items-center justify-between text-[12px]">
                    <div>
                      <span className="font-medium text-on-surface block">{p.name}</span>
                      <span className="font-mono text-[10px] text-primary">{p.sku}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-on-surface tabular-nums">
                        {p.unit_cost ? formatCurrency(p.unit_cost) : 'Cost unset'}
                      </span>
                      <span className="block text-[10px] text-on-surface-variant">
                        Lead: {p.lead_time_days ? `${p.lead_time_days}d` : 'N/A'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-[12px] text-on-surface-variant bg-surface-container-low rounded-lg">
                No catalog items currently mapped to this supplier.
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Add / Edit Supplier Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingSupplier ? 'Edit Vendor Partner' : 'Add Vendor Partner'}
        subtitle={
          editingSupplier
            ? `Updating profile for ${editingSupplier.name}`
            : 'Register a new supplier for replenishment PO creation.'
        }
      >
        <form onSubmit={handleSubmit(onSubmitSupplier)} className="space-y-4 text-[13px]">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[12px]">
              {formError}
            </div>
          )}

          <div>
            <label className="block font-medium text-on-surface mb-1">Company / Vendor Name *</label>
            <input
              type="text"
              {...register('name')}
              placeholder="e.g. Apex Office Wholesale"
              className={`w-full h-9 px-3 rounded-lg border bg-surface-container-low text-on-surface ${
                errors.name ? 'border-rose-500' : 'border-outline-variant/40'
              }`}
            />
            {errors.name && (
              <p className="mt-1 text-[11px] text-rose-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block font-medium text-on-surface mb-1">Contact Person</label>
            <input
              type="text"
              {...register('contact_name')}
              placeholder="e.g. Marcus Vance"
              className="w-full h-9 px-3 rounded-lg border border-outline-variant/40 bg-surface-container-low text-on-surface"
            />
          </div>

          <div>
            <label className="block font-medium text-on-surface mb-1">Email</label>
            <input
              type="email"
              {...register('email')}
              placeholder="orders@apexoffice.example.com"
              className={`w-full h-9 px-3 rounded-lg border bg-surface-container-low text-on-surface ${
                errors.email ? 'border-rose-500' : 'border-outline-variant/40'
              }`}
            />
            {errors.email && (
              <p className="mt-1 text-[11px] text-rose-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block font-medium text-on-surface mb-1">Phone</label>
            <input
              type="text"
              {...register('phone')}
              placeholder="+91 98765 43210"
              className="w-full h-9 px-3 rounded-lg border border-outline-variant/40 bg-surface-container-low text-on-surface"
            />
          </div>

          <div>
            <label className="block font-medium text-on-surface mb-1">Address / Warehouse Location</label>
            <textarea
              rows={2}
              {...register('address')}
              placeholder="Plot 42, Industrial Area, Phase II"
              className="w-full p-2.5 rounded-lg border border-outline-variant/40 bg-surface-container-low text-on-surface text-[12px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/30">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="h-8 px-3 rounded-lg border border-outline-variant/40 text-[12px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-8 px-4 rounded-lg bg-primary text-white font-medium text-[12px] hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting
                ? 'Saving...'
                : editingSupplier
                ? 'Save Changes'
                : 'Register Supplier'}
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
};
