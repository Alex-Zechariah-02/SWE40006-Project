import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums',
  {
    variants: {
      variant: {
        default: 'border-border bg-muted text-muted-foreground',
        success: 'border-success/25 bg-success/12 text-success',
        warning: 'border-warning/30 bg-warning/15 text-warning',
        danger: 'border-destructive/25 bg-destructive/12 text-destructive',
        info: 'border-info/25 bg-info/12 text-info',
        neutral: 'border-border bg-secondary text-secondary-foreground',
        premium: 'border-accent/30 bg-accent/15 text-accent',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
