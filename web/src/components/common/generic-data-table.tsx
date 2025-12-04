'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ColumnDef } from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ActionConfig<T> {
  label: string;
  onClick: (item: T) => void;
  icon?: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
  condition?: (item: T) => boolean;
  showInDropdown?: boolean;
}

interface GenericDataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  emptyStateText?: string;
  onRowClick?: (item: T) => void;
  actions?: ActionConfig<T>[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  className?: string;
  sortable?: boolean;
}

export function GenericDataTable<T>({
  data,
  columns,
  loading = false,
  emptyStateText,
  onRowClick,
  actions = [],
  pagination,
  className = '',
  sortable = true,
}: GenericDataTableProps<T>) {
  const t = useTranslations('Common');

  const renderActions = (item: T) => {
    const visibleActions = actions.filter(action => 
      !action.condition || action.condition(item)
    );

    if (visibleActions.length === 0) return null;

    if (visibleActions.length <= 2) {
      // Render actions directly if there are 1-2 actions
      return (
        <div className="flex items-center gap-2">
          {visibleActions.map((action, idx) => (
            <Button
              key={idx}
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8",
                action.variant === 'destructive' && "text-red-600 hover:text-red-700 hover:bg-red-50"
              )}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick(item);
              }}
            >
              {action.icon}
            </Button>
          ))}
        </div>
      );
    } else {
      // Use dropdown menu for more than 2 actions
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {visibleActions.map((action, idx) => (
              <DropdownMenuItem
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick(item);
                }}
              >
                {action.icon && <span className="mr-2">{action.icon}</span>}
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
  };

  return (
    <div className={`border rounded-md ${className}`}>
      <Table>
        <TableHeader>
          <TableRow>
            {sortable ? (
              columns.map((column, idx) => (
                <TableHead key={idx}>
                  {typeof column.header === 'string' ? column.header : (column.header as any)?.({}) || ''}
                </TableHead>
              ))
            ) : (
              columns.map((column, idx) => (
                <TableHead key={idx}>
                  {typeof column.header === 'string' ? column.header : (column.header as any)?.({}) || ''}
                </TableHead>
              ))
            )}
            {actions && actions.length > 0 && (
              <TableHead className="w-[50px] text-right"></TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={columns.length + (actions && actions.length > 0 ? 1 : 0)} className="text-center py-10">
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : data?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + (actions && actions.length > 0 ? 1 : 0)} className="text-center py-10">
                {emptyStateText || t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            data.map((item: any, rowIndex) => (
              <TableRow 
                key={rowIndex} 
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}
              >
                {columns.map((column: any, colIdx) => {
                  const value = column.accessorFn 
                    ? column.accessorFn(item) 
                    : (column.accessorKey ? item[column.accessorKey] : item[column.id]);
                  
                  return (
                    <TableCell key={colIdx}>
                      {typeof column.cell === 'function' 
                        ? column.cell({ 
                            row: { original: item },
                            getValue: () => value
                          }) 
                        : value}
                    </TableCell>
                  );
                })}
                {actions && actions.length > 0 && (
                  <TableCell className="text-right">
                    {renderActions(item)}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {pagination && (
        <div className="border-t p-4">
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPageChange={pagination.onPageChange}
          />
        </div>
      )}
    </div>
  );
}