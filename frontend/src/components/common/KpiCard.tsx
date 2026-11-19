import React from 'react';
import { cn } from '../../utils/format';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
    isNeutral?: boolean;
  };
  icon?: LucideIcon;
  iconBgColor?: string;
  iconColor?: string;
  className?: string;
  sparklineData?: number[];
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  iconBgColor = 'bg-primary/10',
  iconColor = 'text-primary',
  className,
}) => {
  return (
    <div
      className={cn(
        'rounded-xl bg-surface-container-lowest p-5 border border-outline-variant/30 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="font-overline text-overline uppercase tracking-wider text-on-surface-variant font-semibold">
          {title}
        </span>
        {Icon && (
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs',
              iconBgColor,
              iconColor
            )}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-hero-metric text-hero-metric text-on-surface tabular-nums tracking-tight">
          {value}
        </span>
      </div>

      {(subtitle || trend) && (
        <div className="flex items-center gap-1.5 text-caption font-caption text-on-surface-variant mt-1">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-medium px-1.5 py-0.2 rounded',
                trend.isNeutral
                  ? 'bg-surface-container text-on-surface-variant'
                  : trend.isPositive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
              )}
            >
              {trend.isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : trend.isNeutral ? null : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{trend.value}</span>
            </span>
          )}
          {subtitle && <span>{subtitle}</span>}
        </div>
      )}
    </div>
  );
};
