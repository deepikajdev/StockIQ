import React from 'react';
import { cn } from '../../utils/format';
import { PackageOpen, LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon = PackageOpen,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-12 text-center rounded-xl bg-surface-container-lowest border border-dashed border-outline-variant/60 my-4',
        className
      )}
    >
      <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant mb-4 shadow-xs">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="font-section-title text-[16px] text-on-surface font-semibold mb-1">
        {title}
      </h3>
      {description && (
        <p className="font-caption text-caption text-on-surface-variant max-w-sm mb-5">
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
};
