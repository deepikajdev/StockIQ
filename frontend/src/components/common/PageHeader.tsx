import React from 'react';
import { cn } from '../../utils/format';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  actions,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6',
        className
      )}
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-page-title text-page-title text-on-surface tracking-tight">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <p className="font-caption text-caption text-on-surface-variant max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-center">
          {actions}
        </div>
      )}
    </div>
  );
};
