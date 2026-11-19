import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '../../utils/format';

interface QuantityStepperProps {
  value: number;
  onChange: (newVal: number) => void;
  min?: number;
  max?: number;
  className?: string;
  disabled?: boolean;
}

export const QuantityStepper: React.FC<QuantityStepperProps> = ({
  value,
  onChange,
  min = 1,
  max = 9999,
  className,
  disabled = false,
}) => {
  const handleDecrement = () => {
    if (value > min && !disabled) onChange(value - 1);
  };

  const handleIncrement = () => {
    if (value < max && !disabled) onChange(value + 1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      onChange(Math.max(min, Math.min(max, val)));
    }
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border border-outline-variant/40 bg-surface-container-low p-0.5 shadow-xs',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min || disabled}
        className="w-7 h-7 rounded-md flex items-center justify-center text-on-surface hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>

      <input
        type="number"
        value={value}
        onChange={handleInputChange}
        disabled={disabled}
        min={min}
        max={max}
        className="w-12 h-7 text-center bg-transparent font-medium text-[13px] tabular-nums text-on-surface focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />

      <button
        type="button"
        onClick={handleIncrement}
        disabled={value >= max || disabled}
        className="w-7 h-7 rounded-md flex items-center justify-center text-on-surface hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
