import React from 'react';
import { cn } from '../../utils/format';
import { RISK_LABELS, RISK_TONES } from '../../utils/intelligence';
import type { RiskCategory } from '../../types';

interface RiskBadgeProps {
  category: RiskCategory;
  score?: number;
  className?: string;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ category, score, className }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
      RISK_TONES[category],
      className
    )}
  >
    {RISK_LABELS[category]}
    {score !== undefined && <span className="opacity-70 tabular-nums">({score})</span>}
  </span>
);
