import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Plus, Search, Filter, Edit, Eye, Archive } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { Drawer } from '../components/common/Drawer';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../hooks/useAuth';
import { api, ApiError } from '../api/client';
import { formatCurrency } from '../utils/format';
import type { Page, Product, Category } from '../types';

const productSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(64),
  name: z.string().min(1, 'Product title is required').max(200),
  category_id: z.coerce.number().optional().nullable(),
  unit: z.string().min(1).default('pcs'),
  selling_price: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
    message: 'Selling price must be a non-negative number',
  }),
  cost_price: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
    message: 'Cost price must be a non-negative number',
  }),
  reorder_point: z.coerce.number().min(0, 'Must be 0 or greater'),
  safety_stock: z.coerce.number().min(0, 'Must be 0 or greater'),
});

type ProductFormData = z.infer<typeof productSchema>;

export const Products: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | ''>('');
  const [offset, setOffset] = useState(0);
  const limit = 25;

  // Drawer & Modal state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deactivateProduct, setDeactivateProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: '',
      name: '',
      unit: 'pcs',
      selling_price: '0.00',
      cost_price: '0.00',
      reorder_point: 10,
      safety_stock: 5,
    },
  });

  // Fetch products
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['products', search, selectedCategory, offset],
    queryFn: () =>
      api.get<Page<Product>>('/products', {
        q: search || undefined,
        category_id: selectedCategory || undefined,
        limit,
        offset,
      }),
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
  });

  const openCreateDrawer = () => {
    setEditingProduct(null);
    reset({
      sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      name: '',
      category_id: categories?.[0]?.id || null,
      unit: 'pcs',
      selling_price: '50.00',
      cost_price: '30.00',
      reorder_point: 15,
      safety_stock: 5,
    });
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (prod: Product) => {
    setEditingProduct(prod);
    setValue('sku', prod.sku);
    setValue('name', prod.name);
    setValue('category_id', prod.category_id);
    setValue('unit', prod.unit);
    setValue('selling_price', prod.selling_price);
    setValue('cost_price', prod.cost_price);
    setValue('reorder_point', prod.reorder_point);
    setValue('safety_stock', prod.safety_stock);
    setIsDrawerOpen(true);
  };

  const onFormSubmit = async (formData: ProductFormData) => {
    setSubmitting(true);
    try {
      if (editingProduct) {
        await api.patch(`/products/${editingProduct.id}`, {
          name: formData.name,
          category_id: formData.category_id || undefined,
          unit: formData.unit,
          selling_price: formData.selling_price,
          cost_price: formData.cost_price,
          reorder_point: formData.reorder_point,
          safety_stock: formData.safety_stock,
        });
        toast.success(`Product ${formData.name} updated successfully!`);
      } else {
        await api.post('/products', {
          ...formData,
          category_id: formData.category_id || undefined,
        });
        toast.success(`Product ${formData.name} created successfully!`);
      }
      setIsDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-products'] });
      refetch();
    } catch (err: any) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to save product.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateProduct) return;
    try {
      await api.delete(`/products/${deactivateProduct.id}`);
      toast.success(`Product ${deactivateProduct.sku} archived.`);
      setDeactivateProduct(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to deactivate product.');
    }
  };

  const columns: Column<Product>[] = [
    {
      header: 'SKU',
      accessorKey: 'sku',
      className: 'font-mono text-primary font-semibold text-[12px]',
    },
    {
      header: 'Product Name',
      accessorKey: 'name',
      cell: (p) => (
        <div>
          <span className="font-semibold text-on-surface block">{p.name}</span>
          <span className="text-[11px] text-on-surface-variant">{p.category_name || 'General'}</span>
        </div>
      ),
    },
    {
      header: 'Unit',
      accessorKey: 'unit',
      align: 'center',
    },
    {
      header: 'Selling Price',
      accessorKey: 'selling_price',
      align: 'right',
      cell: (p) => formatCurrency(p.selling_price),
    },
    {
      header: 'Cost Price',
      accessorKey: 'cost_price',
      align: 'right',
      cell: (p) => formatCurrency(p.cost_price),
    },
    {
      header: 'Stock on Hand',
      accessorKey: 'stock_on_hand',
      align: 'right',
      cell: (p) => (
        <span
          className={`font-semibold ${
            p.stock_on_hand <= p.reorder_point ? 'text-amber-700' : 'text-on-surface'
          }`}
        >
          {p.stock_on_hand} {p.unit}
        </span>
      ),
    },
    {
      header: 'Reorder Point',
      accessorKey: 'reorder_point',
      align: 'right',
    },
    {
      header: 'Status',
      align: 'center',
      cell: (p) => (
        <StatusBadge
          status={
            !p.is_active
              ? 'inactive'
              : p.stock_on_hand <= 0
              ? 'out_of_stock'
              : p.stock_on_hand <= p.reorder_point
              ? 'low_stock'
              : 'in_stock'
          }
        />
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (p) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/products/${p.id}`)}
            title="View Details"
            className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => openEditDrawer(p)}
                title="Edit Product"
                className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDeactivateProduct(p)}
                title="Deactivate"
                className="p-1 rounded text-on-surface-variant hover:text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Archive className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Registry"
        subtitle="Manage stationery catalog items, pricing rules, and inventory reorder parameters."
        actions={
          isAdmin && (
            <button
              onClick={openCreateDrawer}
              className="h-9 px-4 rounded-lg bg-primary text-white font-medium text-[13px] hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
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
              placeholder="Search by SKU, product title..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-outline-variant/40 bg-surface-container-low text-on-surface text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-on-surface-variant" />
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value ? Number(e.target.value) : '');
                setOffset(0);
              }}
              className="h-9 px-3 rounded-lg border border-outline-variant/40 bg-surface-container-low text-on-surface text-[13px] focus:outline-none"
            >
              <option value="">All Categories</option>
              {categories?.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Products Data Table */}
      <DataTable
        columns={columns}
        data={data?.items || []}
        keyExtractor={(p) => p.id}
        isLoading={isLoading}
        onRowClick={(p) => navigate(`/products/${p.id}`)}
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

      {/* Add / Edit Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingProduct ? 'Edit Catalog Product' : 'Add Catalog Product'}
        subtitle={
          editingProduct
            ? `Update SKU: ${editingProduct.sku}`
            : 'Create an SKU record with required financial and safety metrics.'
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="h-9 px-4 rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-on-surface hover:bg-surface-container text-[13px]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit(onFormSubmit)}
              className="h-9 px-4 rounded-lg bg-primary text-white text-[13px] font-medium shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4 text-[13px]">
          <div>
            <label className="block font-medium text-on-surface mb-1">
              SKU <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              disabled={!!editingProduct}
              {...register('sku')}
              placeholder="e.g. PEN-GEL-05"
              className="w-full h-9 px-3 rounded-lg border border-outline-variant/40 bg-surface-container-low font-mono disabled:opacity-60"
            />
            {errors.sku && <p className="text-rose-600 text-[11px] mt-0.5">{errors.sku.message}</p>}
          </div>

          <div>
            <label className="block font-medium text-on-surface mb-1">
              Product Title <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              {...register('name')}
              placeholder="e.g. Pilot G2 0.5mm Gel Pen"
              className="w-full h-9 px-3 rounded-lg border border-outline-variant/40 bg-surface-container-low"
            />
            {errors.name && <p className="text-rose-600 text-[11px] mt-0.5">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-on-surface mb-1">Category</label>
              <select
                {...register('category_id')}
                className="w-full h-9 px-3 rounded-lg border border-outline-variant/40 bg-surface-container-low"
              >
                <option value="">No Category</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-on-surface mb-1">Unit</label>
              <input
                type="text"
                {...register('unit')}
                placeholder="pcs / pack / box"
                className="w-full h-9 px-3 rounded-lg border border-outline-variant/40 bg-surface-container-low"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-on-surface mb-1">
                Selling Price (₹) <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                {...register('selling_price')}
                placeholder="45.00"
                className="w-full h-9 px-3 rounded-lg border border-outline-variant/40 bg-surface-container-low"
              />
              {errors.selling_price && (
                <p className="text-rose-600 text-[11px] mt-0.5">{errors.selling_price.message}</p>
              )}
            </div>
            <div>
              <label className="block font-medium text-on-surface mb-1">
                Cost Price (₹) <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                {...register('cost_price')}
                placeholder="25.00"
                className="w-full h-9 px-3 rounded-lg border border-outline-variant/40 bg-surface-container-low"
              />
              {errors.cost_price && (
                <p className="text-rose-600 text-[11px] mt-0.5">{errors.cost_price.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-on-surface mb-1">Reorder Point</label>
              <input
                type="number"
                {...register('reorder_point')}
                placeholder="20"
                className="w-full h-9 px-3 rounded-lg border border-outline-variant/40 bg-surface-container-low"
              />
            </div>
            <div>
              <label className="block font-medium text-on-surface mb-1">Safety Stock</label>
              <input
                type="number"
                {...register('safety_stock')}
                placeholder="10"
                className="w-full h-9 px-3 rounded-lg border border-outline-variant/40 bg-surface-container-low"
              />
            </div>
          </div>
        </form>
      </Drawer>

      {/* Deactivate Modal */}
      <Modal
        isOpen={!!deactivateProduct}
        onClose={() => setDeactivateProduct(null)}
        title="Deactivate Product"
        description={`Are you sure you want to archive ${deactivateProduct?.sku}? Products with ledger history are never permanently deleted.`}
        footer={
          <>
            <button
              onClick={() => setDeactivateProduct(null)}
              className="h-8 px-3 rounded-lg border border-outline-variant/40 text-on-surface text-[12px]"
            >
              Cancel
            </button>
            <button
              onClick={handleDeactivate}
              className="h-8 px-3 rounded-lg bg-rose-600 text-white font-medium text-[12px]"
            >
              Confirm Deactivation
            </button>
          </>
        }
      >
        <p className="text-[13px] text-on-surface-variant">
          This product will be archived from active catalog listings and POS baskets, but all past purchase orders, ledger movements, and sales entries remain intact for financial auditing.
        </p>
      </Modal>
    </div>
  );
};
