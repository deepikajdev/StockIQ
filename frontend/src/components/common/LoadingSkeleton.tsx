import React from 'react';
import { cn } from '../../utils/format';

interface LoadingSkeletonProps {
  rows?: number;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  rows = 5,
  className,
}) => {
  return (
    <div className={cn('w-full space-y-3 p-4 animate-pulse', className)}>
      <div className="h-8 bg-surface-container-high rounded-md w-1/3 mb-4" />
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="flex gap-4 items-center">
          <div className="h-5 bg-surface-container rounded w-1/6" />
          <div className="h-5 bg-surface-container rounded w-1/3" />
          <div className="h-5 bg-surface-container rounded w-1/4" />
          <div className="h-5 bg-surface-container rounded w-1/5" />
        </div>
      ))}
    </div>
  );
};
