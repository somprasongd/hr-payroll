'use client';

import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ActionItem<T> {
  label: string;
  onClick: (item: T) => void;
  icon?: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
  condition?: (item: T) => boolean;
}

interface ActionDropdownProps<T> {
  item: T;
  actions: ActionItem<T>[];
  trigger?: React.ReactNode;
  disabled?: boolean;
}

export function ActionDropdown<T>({
  item,
  actions,
  trigger,
  disabled = false,
}: ActionDropdownProps<T>) {
  const t = useTranslations('Common');

  const visibleActions = actions.filter(action => 
    !action.condition || action.condition(item)
  );

  if (visibleActions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ? (
          <div onClick={(e) => e.stopPropagation()}>{trigger}</div>
        ) : (
          <Button 
            variant="ghost" 
            size="icon" 
            disabled={disabled}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
        {visibleActions.map((action, idx) => {
          const buttonVariant = action.variant || 'default';
          return (
            <DropdownMenuItem
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick(item);
              }}
              className={buttonVariant === 'destructive' ? 'text-destructive focus:text-destructive' : ''}
            >
              {action.icon && <span className="mr-2">{action.icon}</span>}
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}