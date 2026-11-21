// Pure presentation helpers for Intelligence Engine data.
// No network calls and no React dependencies so these can be unit tested directly.

import type {
  ForecastSeries,
  ProductIntelligence,
  RiskCategory,
  StockoutRisk,
} from '../types';

export const RISK_LABELS: Record<RiskCategory, string> = {
  critical: 'Critical',
  dead_stock: 'Dead stock',
  slow_moving: 'Slow moving',
  excess: 'Excess inventory',
  low_stock: 'Low stock',
  healthy: 'Healthy',
};

export const RISK_TONES: Record<RiskCategory, string> = {
  critical: 'bg-rose-100 text-rose-800 border-rose-200',
  dead_stock: 'bg-orange-100 text-orange-800 border-orange-200',
  slow_moving: 'bg-amber-100 text-amber-800 border-amber-200',
  excess: 'bg-violet-100 text-violet-800 border-violet-200',
  low_stock: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  healthy: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

export const STOCKOUT_LABELS: Record<StockoutRisk, string> = {
  critical: 'Stockout before lead time',
  high: 'High risk',
  medium: 'Medium risk',
  low: 'Low risk',
  none: 'No measurable demand',
};

const METHOD_LABELS: Record<string, string> = {
  recency_weighted_moving_average: 'Recency-weighted moving average (30 days)',
  category_average_fallback: 'Category average fallback (limited history)',
  simple_average_fallback: 'Simple average fallback (limited history)',
  no_recent_sales_zero_baseline: 'No recent sales — zero baseline',
  no_history_zero_baseline: 'No history — zero baseline',
};

/** Human-readable name of the estimator that actually produced a forecast. */
export function forecastMethodLabel(method: string): string {
  return METHOD_LABELS[method] ?? method.replace(/_/g, ' ');
}

/** Short explanation of why a product has (or does not have) a demand estimate. */
export function forecastSourceNote(item: ProductIntelligence): string {
  const f = item.forecast;
  if (f.method === 'no_recent_sales_zero_baseline') {
    return `No units sold in the last ${item.demand_stats.window_days} days. Demand is treated as zero; no supplier quantity is proposed.`;
  }
  if (f.uses_category_fallback) {
    return `Only ${f.data_days_available} selling day(s) in the window, so the category average is used as a documented fallback.`;
  }
  if (f.insufficient_history) {
    return `Limited history (${f.data_days_available} selling day(s)); the product's own simple average is used.`;
  }
  return `Based on ${f.data_days_available} selling day(s) in the last ${item.demand_stats.window_days} days.`;
}

export interface ForecastChartRow {
  date: string;
  actual: number | null;
  forecast: number | null;
}

/** Split history and projection into two recharts series at the boundary date. */
export function buildForecastChartData(series: ForecastSeries): ForecastChartRow[] {
  return series.points.map((p) => ({
    date: p.date,
    actual: p.is_forecast ? null : p.units,
    forecast: p.is_forecast ? p.units : null,
  }));
}

/** Format a unit count without inventing precision it does not have. */
export function formatUnits(value: number | null | undefined, unit = 'units'): string {
  if (value === null || value === undefined) return '—';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded} ${unit}`;
}

/** True when the UI must warn that no supplier data backs a recommendation. */
export function needsSupplierWarning(item: ProductIntelligence): boolean {
  return (
    item.reorder_recommendation.needs_reorder &&
    item.reorder_recommendation.supplier === null
  );
}
