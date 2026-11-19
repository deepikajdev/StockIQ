import React from 'react';
import { cn } from '../../utils/format';

export type StatusType =
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'draft'
  | 'received'
  | 'completed'
  | 'cancelled'
  | 'active'
  | 'inactive';

interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className }) => {
  const norm = status.toLowerCase().replace(/[\s-]/g, '_');

  let dotColor = 'bg-slate-400';
  let containerColor = 'bg-surface-container text-on-surface-variant';
  let defaultLabel = label || status;

  switch (norm) {
    case 'in_stock':
    case 'active':
    case 'received':
    case 'completed':
      dotColor = 'bg-emerald-500';
      containerColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      defaultLabel = label || (norm === 'in_stock' ? 'In Stock' : norm === 'active' ? 'Active' : norm === 'received' ? 'Received' : 'Completed');
      break;

    case 'low_stock':
      dotColor = 'bg-amber-500';
      containerColor = 'bg-amber-50 text-amber-800 border-amber-200';
      defaultLabel = label || 'Low Stock';
      break;

    case 'out_of_stock':
    case 'cancelled':
    case 'inactive':
      dotColor = 'bg-rose-500';
      containerColor = 'bg-rose-50 text-rose-800 border-rose-200';
      defaultLabel = label || (norm === 'out_of_stock' ? 'Out of Stock' : norm === 'cancelled' ? 'Cancelled' : 'Inactive');
      break;

    case 'draft':
      dotColor = 'bg-slate-400';
      containerColor = 'bg-slate-100 text-slate-700 border-slate-200';
      defaultLabel = label || 'Draft';
      break;

    default:
      break;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-transparent shadow-xs select-none',
        containerColor,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />
      <span>{defaultLabel}</span>
    </span>
  );
};
