import React, { useEffect } from 'react';
import { cn } from '../../utils/format';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'max-w-[480px]',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          className={cn(
            'w-screen bg-surface-container-lowest shadow-[0_20px_25px_-5px_rgba(15,23,42,0.12),0_8px_10px_-6px_rgba(15,23,42,0.08)] flex flex-col justify-between border-l border-outline-variant/30',
            width
          )}
        >
          {/* Drawer Header */}
          <div className="p-5 bg-surface-container-low border-b border-outline-variant/30 flex items-start justify-between">
            <div>
              <h3 className="font-section-title text-[18px] text-on-surface font-semibold">
                {title}
              </h3>
              {subtitle && (
                <p className="font-caption text-caption text-on-surface-variant mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5">{children}</div>

          {/* Drawer Footer */}
          {footer && (
            <div className="p-4 bg-surface-container-low border-t border-outline-variant/30 flex items-center justify-between gap-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
