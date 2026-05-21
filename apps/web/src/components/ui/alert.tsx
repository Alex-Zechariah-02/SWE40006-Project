import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'rounded-md border px-4 py-3 text-sm [&:has(svg)]:flex [&:has(svg)]:gap-3',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-card-foreground',
        destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
        warning: 'border-warning/30 bg-warning/10 text-warning',
        success: 'border-success/30 bg-success/10 text-success',
        info: 'border-info/30 bg-info/10 text-info',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, role, ...props }, ref) => {
    const computedRole =
      role ?? (variant === 'destructive' || variant === 'warning' ? 'alert' : 'status');
    return (
      <div
        ref={ref}
        role={computedRole}
        className={cn(alertVariants({ variant }), className)}
        {...props}
      />
    );
  }
);
Alert.displayName = 'Alert';

export { alertVariants };
