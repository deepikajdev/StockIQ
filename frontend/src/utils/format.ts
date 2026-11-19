import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format monetary values adhering to Indian Numbering System with Rupee symbol:
 * e.g. "124580.00" -> "₹1,24,580.00"
 */
export function formatCurrency(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '₹0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₹0.00';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format dates cleanly: e.g. "2026-11-16T14:30:00" -> "16 Nov 2026"
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Format timestamps with time: e.g. "16 Nov 2026, 14:30"
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Format signed deltas for stock movements: e.g. +24 or -5
 */
export function formatSignedDelta(num: number): string {
  if (num > 0) return `+${num}`;
  return `${num}`;
}
