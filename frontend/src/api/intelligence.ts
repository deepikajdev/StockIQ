// Phase 3: read-only Intelligence Engine API access.
// These helpers never issue POST/PATCH/DELETE — recommendations stay advisory.

import { api } from './client';
import type {
  ForecastEvaluation,
  ForecastSeries,
  IntelligenceSummary,
  ProductIntelligence,
  ReorderQueue,
  RiskCategory,
  RiskReport,
} from '../types';

export const INTELLIGENCE_ENDPOINTS = {
  summary: '/intelligence/summary',
  reorder: '/intelligence/reorder-recommendations',
  risk: '/intelligence/risk',
  product: (productId: number) => `/intelligence/products/${productId}`,
  forecast: (productId: number) => `/intelligence/products/${productId}/forecast`,
  evaluation: '/intelligence/evaluation',
} as const;

export const intelligenceApi = {
  summary: (riskCategory?: RiskCategory) =>
    api.get<IntelligenceSummary>(INTELLIGENCE_ENDPOINTS.summary, {
      risk_category: riskCategory,
    }),

  reorderQueue: () => api.get<ReorderQueue>(INTELLIGENCE_ENDPOINTS.reorder),

  riskReport: (riskCategory?: RiskCategory) =>
    api.get<RiskReport>(INTELLIGENCE_ENDPOINTS.risk, {
      risk_category: riskCategory,
    }),

  product: (productId: number) =>
    api.get<ProductIntelligence>(INTELLIGENCE_ENDPOINTS.product(productId)),

  forecast: (productId: number, historyDays = 30, forecastDays = 14) =>
    api.get<ForecastSeries>(INTELLIGENCE_ENDPOINTS.forecast(productId), {
      history_days: historyDays,
      forecast_days: forecastDays,
    }),

  evaluation: () => api.get<ForecastEvaluation>(INTELLIGENCE_ENDPOINTS.evaluation),
};
