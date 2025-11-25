'use client';

import * as React from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';

export interface TimeInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  value?: string;
  onValueChange?: (value: string) => void;
}

const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(
  ({ className, value, onValueChange, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      onValueChange?.(newValue);
      onChange?.(e);
    };

    return (
      <Input
        type="time"
        className={cn('', className)}
        ref={ref}
        value={value}
        onChange={handleChange}
        {...props}
      />
    );
  }
);

TimeInput.displayName = 'TimeInput';

export { TimeInput };
