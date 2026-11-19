import React from 'react';
import { cn } from '../../utils/format';
import { LoadingSkeleton } from './LoadingSkeleton';
import { EmptyState } from './EmptyState';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    onPageChange: (newOffset: number) => void;
  };
  onRowClick?: (item: T) => void;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading,
  emptyTitle = 'No records found',
  emptyDescription,
  pagination,
  onRowClick,
  className,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="rounded-xl bg-surface-container-lowest border border-outline-variant/30 overflow-hidden shadow-xs">
        <LoadingSkeleton rows={6} />
      </div>
    );
  }

  const hasData = data && data.length > 0;

  const currentPage = pagination
    ? Math.floor(pagination.offset / pagination.limit) + 1
    : 1;
  const totalPages = pagination
    ? Math.ceil(pagination.total / pagination.limit)
    : 1;

  return (
    <div
      className={cn(
        'rounded-xl bg-surface-container-lowest border border-outline-variant/30 overflow-hidden shadow-xs flex flex-col',
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-surface-container-low/70 border-b border-outline-variant/30 text-overline font-overline text-on-surface-variant uppercase tracking-wider select-none">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={cn(
                    'py-3 px-4 font-semibold text-[11px]',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20 font-body-default text-body-default text-on-surface">
            {hasData ? (
              data.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  onClick={() => onRowClick && onRowClick(item)}
                  className={cn(
                    'transition-colors hover:bg-surface-container-low/50',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {columns.map((col, idx) => (
                    <td
                      key={idx}
                      className={cn(
                        'py-3.5 px-4 text-table-cell font-table-cell',
                        col.align === 'right' && 'text-right tabular-nums',
                        col.align === 'center' && 'text-center',
                        col.className
                      )}
                    >
                      {col.cell
                        ? col.cell(item)
                        : col.accessorKey
                        ? (item[col.accessorKey] as unknown as React.ReactNode)
                        : null}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && hasData && (
        <div className="px-4 py-3 bg-surface-container-low/30 border-t border-outline-variant/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-caption font-caption text-on-surface-variant select-none">
          <div>
            Showing{' '}
            <span className="font-semibold text-on-surface">
              {pagination.offset + 1}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-on-surface">
              {Math.min(pagination.offset + pagination.limit, pagination.total)}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-on-surface">
              {pagination.total}
            </span>{' '}
            entries
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() =>
                pagination.onPageChange(
                  Math.max(0, pagination.offset - pagination.limit)
                )
              }
              disabled={pagination.offset === 0}
              className="h-8 px-2.5 rounded-md border border-outline-variant/40 bg-surface-container-lowest text-on-surface disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <span className="px-2 text-on-surface font-medium">
              Page {currentPage} of {totalPages || 1}
            </span>
            <button
              onClick={() =>
                pagination.onPageChange(pagination.offset + pagination.limit)
              }
              disabled={
                pagination.offset + pagination.limit >= pagination.total
              }
              className="h-8 px-2.5 rounded-md border border-outline-variant/40 bg-surface-container-lowest text-on-surface disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container transition-colors flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
