import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RISK_LABELS,
  STOCKOUT_LABELS,
  buildForecastChartData,
  forecastMethodLabel,
  forecastSourceNote,
  formatUnits,
  needsSupplierWarning,
} from '../utils/intelligence.ts';
import type { ForecastSeries, ProductIntelligence } from '../types/index.ts';

function makeItem(overrides: Partial<ProductIntelligence> = {}): ProductIntelligence {
  return {
    product_id: 1,
    sku: 'TEST-1',
    name: 'Test Product',
    category_name: 'Stationery',
    unit: 'pcs',
    is_active: true,
    current_stock: 5,
    cost_price: '4.00',
    demand_stats: {
      total_units_sold: 30,
      observed_sale_days: 30,
      window_days: 30,
      first_sale_date: '2026-10-22',
      last_sale_date: '2026-11-20',
      days_since_last_sale: 1,
      avg_daily_demand: 1,
      weighted_daily_demand: 1.2,
      insufficient_history: false,
    },
    forecast: {
      daily_demand: 1.2,
      forecast_7d_units: 8.4,
      forecast_30d_units: 36,
      method: 'recency_weighted_moving_average',
      is_machine_learning: false,
      uses_category_fallback: false,
      data_days_available: 30,
      insufficient_history: false,
    },
    stockout_prediction: {
      days_until_stockout: 4.2,
      stockout_risk: 'critical',
      out_of_stock: false,
      current_stock: 5,
      avg_daily_demand: 1.2,
      lead_time_days: 7,
      lead_time_is_assumed: false,
      will_stockout_before_reorder: true,
    },
    reorder_recommendation: {
      needs_reorder: true,
      configured_reorder_point: 10,
      calculated_reorder_point: 18,
      effective_reorder_point: 18,
      current_stock: 5,
      target_stock: 25,
      raw_qty_needed: 20,
      min_order_qty: 50,
      reorder_qty: 50,
      unit_cost: '5.50',
      estimated_order_cost: '275.00',
      supplier: {
        supplier_id: 1,
        supplier_name: 'Test Supplier',
        lead_time_days: 7,
        min_order_qty: 50,
        unit_cost: '5.50',
      },
      explanation: ['Calculated reorder point...', 'Advisory only'],
      explanation_details: {
        lookback_days: 30,
        window_start: '2026-10-22',
        window_end: '2026-11-20',
        units_sold: 30,
        avg_daily_sales: 1,
        demand_basis: 1.2,
        current_stock: 5,
        lead_time_days: 7,
        lead_time_source: 'Test Supplier',
        lead_time_is_assumed: false,
        safety_stock: 4,
        review_period_days: 7,
        reorder_point_calculated: 18,
        reorder_point_manual: 10,
        effective_reorder_point: 18,
        target_stock: 25,
        suggested_qty: 50,
        adjusted_for_moq: true,
        min_order_qty: 50,
        formula_reorder_point: 'ceil(1.20 × 7) + 4 = 18',
        formula_target_stock: 'ceil(1.20 × (7 + 7)) + 4 = 25',
        formula_suggested_qty: 'max(MOQ 50, ceil(25 − 5)) = 50',
        disclaimer: 'Estimate based on recent sales; not a guarantee.',
      },
      formula: 'reorder_qty = ...',
    },
    risk: {
      risk_score: 95,
      risk_category: 'critical',
      days_of_cover: 4.2,
      reasons: ['Low cover'],
      recommended_action: 'Raise a purchase order immediately.',
    },
    ...overrides,
  };
}

describe('Intelligence presentation helpers', () => {
  it('labels every risk category and stockout band', () => {
    assert.equal(RISK_LABELS.dead_stock, 'Dead stock');
    assert.equal(RISK_LABELS.healthy, 'Healthy');
    assert.equal(STOCKOUT_LABELS.none, 'No measurable demand');
  });

  it('maps documented method names and leaves unknown methods readable', () => {
    assert.equal(
      forecastMethodLabel('recency_weighted_moving_average'),
      'Recency-weighted moving average (30 days)'
    );
    assert.equal(forecastMethodLabel('something_new'), 'something new');
  });

  it('explains a zero-sales baseline without implying demand', () => {
    const item = makeItem({
      forecast: {
        ...makeItem().forecast,
        daily_demand: 0,
        method: 'no_recent_sales_zero_baseline',
        data_days_available: 0,
      },
    });
    const note = forecastSourceNote(item);
    assert.match(note, /No units sold/);
    assert.match(note, /treated as zero/i);
  });

  it('discloses category fallback for sparse history', () => {
    const item = makeItem({
      forecast: {
        ...makeItem().forecast,
        method: 'category_average_fallback',
        uses_category_fallback: true,
        data_days_available: 2,
      },
    });
    assert.match(forecastSourceNote(item), /category average/i);
  });

  it('splits chart series at the history/forecast boundary', () => {
    const series: ForecastSeries = {
      product_id: 1,
      sku: 'TEST-1',
      name: 'Test Product',
      method: 'recency_weighted_moving_average',
      daily_demand: 1.2,
      history_days: 2,
      forecast_days: 2,
      points: [
        { date: '2026-11-19', units: 1, is_forecast: false },
        { date: '2026-11-20', units: 2, is_forecast: false },
        { date: '2026-11-21', units: 1.2, is_forecast: true },
        { date: '2026-11-22', units: 1.2, is_forecast: true },
      ],
    };
    const rows = buildForecastChartData(series);
    assert.equal(rows.length, 4);
    assert.deepEqual(rows[0], { date: '2026-11-19', actual: 1, forecast: null });
    assert.deepEqual(rows[2], { date: '2026-11-21', actual: null, forecast: 1.2 });
  });

  it('formats units and flags missing supplier data', () => {
    assert.equal(formatUnits(2.25, 'pcs'), '2.3 pcs');
    assert.equal(formatUnits(null), '—');
    assert.equal(needsSupplierWarning(makeItem()), false);
    assert.equal(
      needsSupplierWarning(
        makeItem({
          reorder_recommendation: {
            ...makeItem().reorder_recommendation,
            supplier: null,
          },
        })
      ),
      true
    );
  });
});
