import React, { useEffect } from 'react';
import { cn } from '../../utils/format';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      <div className="flex min-h-full items-center justify-center p-4 text-center">
        <div
          className={cn(
            'w-full transform rounded-xl bg-surface-container-lowest p-6 text-left align-middle shadow-xl transition-all border border-outline-variant/30',
            maxWidthClasses[maxWidth]
          )}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-section-title text-[18px] text-on-surface font-semibold">
                {title}
              </h3>
              {description && (
                <p className="font-caption text-caption text-on-surface-variant mt-0.5">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="py-2">{children}</div>

          {footer && (
            <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-outline-variant/30">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
