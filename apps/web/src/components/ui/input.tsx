import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-field px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

const InputPrefix = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground',
      className
    )}
    {...props}
  />
));
InputPrefix.displayName = 'InputPrefix';

const InputSuffix = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground',
      className
    )}
    {...props}
  />
));
InputSuffix.displayName = 'InputSuffix';

export { Input, InputPrefix, InputSuffix };
