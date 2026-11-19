import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { useAuth } from '../hooks/useAuth';

export const RoleVariants: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'rbac' | 'states'>('rbac');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Role Variants & System States"
        subtitle="Operational security verification matrix and UI resilience test harness."
      />

      <div className="flex border-b border-outline-variant/30 gap-6 text-[13px] font-medium">
        <button
          onClick={() => setActiveTab('rbac')}
          className={`pb-3 transition-colors ${
            activeTab === 'rbac'
              ? 'border-b-2 border-primary text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Role-Based Access Control (RBAC) Matrix
        </button>
        <button
          onClick={() => setActiveTab('states')}
          className={`pb-3 transition-colors ${
            activeTab === 'states'
              ? 'border-b-2 border-primary text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          System State Resilience Showcase
        </button>
      </div>

      {activeTab === 'rbac' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <span className="font-semibold text-on-surface text-[14px]">
                  Active Session: {user?.full_name}
                </span>
                <span className="text-[12px] text-on-surface-variant block capitalize">
                  Current Privilege Level: {user?.role} Mode
                </span>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-surface-container text-on-surface-variant font-mono text-[11px] uppercase font-semibold">
              Verified by FastAPI
            </span>
          </div>

          <div className="rounded-xl bg-surface-container-lowest border border-outline-variant/30 overflow-hidden shadow-xs">
            <table className="w-full text-left text-[12px] border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant/30 text-overline uppercase text-on-surface-variant">
                  <th className="py-3 px-4">System Capability / Action</th>
                  <th className="py-3 px-4 text-center">Floor Staff</th>
                  <th className="py-3 px-4 text-center">Store Admin</th>
                  <th className="py-3 px-4">API Enforcement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                <tr>
                  <td className="py-3 px-4 font-medium">Browse Products & Inventory</td>
                  <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Allowed</td>
                  <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Allowed</td>
                  <td className="py-3 px-4 font-mono text-[11px] text-on-surface-variant">GET /products, /inventory</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium">Execute New Sales (POS)</td>
                  <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Allowed</td>
                  <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Allowed</td>
                  <td className="py-3 px-4 font-mono text-[11px] text-on-surface-variant">POST /sales</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium">Create & Edit Products</td>
                  <td className="py-3 px-4 text-center text-rose-600 font-bold">✕ Hidden (403)</td>
                  <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Allowed</td>
                  <td className="py-3 px-4 font-mono text-[11px] text-on-surface-variant">POST, PATCH /products (admin_only)</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium">Adjust Stock (Signed Delta)</td>
                  <td className="py-3 px-4 text-center text-rose-600 font-bold">✕ Hidden (403)</td>
                  <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Allowed</td>
                  <td className="py-3 px-4 font-mono text-[11px] text-on-surface-variant">POST /inventory/adjustments (admin_only)</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium">Cancel Sale & Revert Ledger</td>
                  <td className="py-3 px-4 text-center text-rose-600 font-bold">✕ Hidden (403)</td>
                  <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Allowed</td>
                  <td className="py-3 px-4 font-mono text-[11px] text-on-surface-variant">POST /sales/&#123;id&#125;/cancel (admin_only)</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium">Manage Suppliers</td>
                  <td className="py-3 px-4 text-center text-rose-600 font-bold">✕ Hidden (403)</td>
                  <td className="py-3 px-4 text-center text-emerald-600 font-bold">✓ Allowed</td>
                  <td className="py-3 px-4 font-mono text-[11px] text-on-surface-variant">POST, PATCH /suppliers (admin_only)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'states' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 space-y-4">
            <h4 className="font-semibold text-on-surface text-[14px]">Loading Skeleton State</h4>
            <LoadingSkeleton rows={3} />
          </div>

          <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 space-y-4">
            <h4 className="font-semibold text-on-surface text-[14px]">Zero-Data Empty State</h4>
            <EmptyState
              title="No items found in this category"
              description="Try adjusting your search criteria or resetting filters to view all products."
            />
          </div>

          <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 space-y-4">
            <h4 className="font-semibold text-on-surface text-[14px]">Network Error Recovery State</h4>
            <ErrorState
              title="Failed to fetch supplier inventory"
              message="The server did not respond within the timeout window. Please check your network connection."
              onRetry={() => alert('Retrying fetch...')}
            />
          </div>
        </div>
      )}
    </div>
  );
};
