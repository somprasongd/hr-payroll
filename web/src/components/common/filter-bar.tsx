'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RotateCcw, Filter } from 'lucide-react';
import { useTranslations } from 'next-intl';

type FilterType = 'text' | 'select' | 'date' | 'number';

interface BaseFilterConfig {
  id: string;
  label: string;
  type: FilterType;
  className?: string;
}

interface TextFilterConfig extends BaseFilterConfig {
  type: 'text';
  placeholder?: string;
}

interface SelectFilterConfig extends BaseFilterConfig {
  type: 'select';
  options: { value: string; label: string }[];
}

interface DateFilterConfig extends BaseFilterConfig {
  type: 'date';
}

interface NumberFilterConfig extends BaseFilterConfig {
  type: 'number';
}

type FilterConfig = TextFilterConfig | SelectFilterConfig | DateFilterConfig | NumberFilterConfig;

interface FilterBarProps {
  filters: FilterConfig[];
  values: Record<string, any>;
  onFilterChange: (filterId: string, value: any) => void;
  onClearAll?: () => void;
  className?: string;
  showFilters?: boolean;
  setShowFilters?: (show: boolean) => void;
  onSearch?: () => void;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

export function FilterBar({
  filters,
  values,
  onFilterChange,
  onClearAll,
  className = '',
  showFilters = true,
  setShowFilters,
  onSearch,
  searchPlaceholder,
  searchValue,
  onSearchChange,
}: FilterBarProps) {
  const t = useTranslations('Common');

  const hasActiveFilters = filters.some(filter => {
    if (filter.type === 'select') {
      return values[filter.id] && values[filter.id] !== 'all';
    }
    return values[filter.id] && values[filter.id] !== '';
  });

  return (
    <div className={`bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-4 ${className} ${!showFilters ? 'hidden md:block' : ''}`}>
      <div className="flex flex-col md:flex-row gap-4">
        {onSearch && searchPlaceholder && (
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder={searchPlaceholder}
                value={searchValue || ''}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="pl-4"
              />
            </div>
            <Button type="button" variant="secondary" onClick={onSearch}>
              {t('search')}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="flex flex-col md:flex-row gap-4 flex-1 w-full md:w-auto">
          {filters.map((filter) => {
            if (filter.type === 'select') {
              return (
                <div key={filter.id} className={filter.className || 'w-full md:w-[200px]'}>
                  <Select 
                    value={values[filter.id] || 'all'} 
                    onValueChange={(value) => onFilterChange(filter.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={filter.label} />
                    </SelectTrigger>
                    <SelectContent>
                      {filter.options.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            } else if (filter.type === 'text') {
              return (
                <div key={filter.id} className={filter.className || 'w-full md:w-[200px]'}>
                  <Input
                    placeholder={filter.placeholder || filter.label}
                    value={values[filter.id] || ''}
                    onChange={(e) => onFilterChange(filter.id, e.target.value)}
                  />
                </div>
              );
            } else if (filter.type === 'date' || filter.type === 'number') {
              return (
                <div key={filter.id} className={filter.className || 'w-full md:w-[200px]'}>
                  <Input
                    type={filter.type}
                    placeholder={filter.label}
                    value={values[filter.id] || ''}
                    onChange={(e) => onFilterChange(filter.id, e.target.value)}
                  />
                </div>
              );
            }
            return null;
          })}
        </div>

        <div className="flex items-center justify-end ml-auto">
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="icon"
              onClick={onClearAll}
              title={t('clearFilter')}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}