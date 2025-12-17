'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const DEFAULT_AUTO_DISMISS_DURATION = 5000; // 5 seconds

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 pr-10 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4',
  {
    variants: {
      variant: {
        success: 'border-green-500/50 text-green-600 [&>svg]:text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400',
        error: 'border-red-500/50 text-red-600 [&>svg]:text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400',
        warning: 'border-yellow-500/50 text-yellow-600 [&>svg]:text-yellow-600 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-400',
        info: 'border-blue-500/50 text-blue-600 [&>svg]:text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  }
);

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export interface DismissibleAlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  /** Alert title (optional) */
  title?: string;
  /** Callback when alert is dismissed */
  onDismiss?: () => void;
  /** Whether to auto-dismiss the alert (default: true for success, false for others) */
  autoDismiss?: boolean;
  /** Auto-dismiss duration in milliseconds (default: 5000ms) */
  autoDismissDuration?: number;
  /** Whether to show close button (default: true) */
  showCloseButton?: boolean;
}

export function DismissibleAlert({
  className,
  variant = 'info',
  title,
  children,
  onDismiss,
  autoDismiss,
  autoDismissDuration = DEFAULT_AUTO_DISMISS_DURATION,
  showCloseButton = true,
  ...props
}: DismissibleAlertProps) {
  const [isVisible, setIsVisible] = React.useState(true);
  
  // Default autoDismiss based on variant (success = true, others = false)
  const shouldAutoDismiss = autoDismiss ?? variant === 'success';

  React.useEffect(() => {
    if (!shouldAutoDismiss || autoDismissDuration <= 0) return;

    const timer = setTimeout(() => {
      handleDismiss();
    }, autoDismissDuration);

    return () => clearTimeout(timer);
  }, [shouldAutoDismiss, autoDismissDuration]);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) return null;

  const Icon = iconMap[variant || 'info'];

  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon className="h-4 w-4" />
      {showCloseButton && (
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-2 top-2 rounded-md p-1 opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-opacity"
          aria-label="Close alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <div>
        {title && (
          <h5 className="mb-1 font-medium leading-none tracking-tight">
            {title}
          </h5>
        )}
        <div className="text-sm [&_p]:leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

// Export default duration for external use
export { DEFAULT_AUTO_DISMISS_DURATION };
