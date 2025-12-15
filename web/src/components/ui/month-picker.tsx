'use client';

import * as React from 'react';
import { format, addYears, subYears, setMonth, setYear, startOfMonth, isBefore } from 'date-fns';
import { th, enUS } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const locales: Record<string, any> = {
  th: th,
  en: enUS,
  my: enUS, // Fallback to English for Burmese if 'my' is not available
};

interface MonthPickerProps {
  value?: string; // Format: YYYY-MM-01 or YYYY-MM
  onValueChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
}

export function MonthPicker({
  value,
  onValueChange,
  className,
  placeholder = "Select month",
  disabled = false,
  minDate,
}: MonthPickerProps) {
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const dateFnsLocale = locales[locale] || enUS;
  const [date, setDate] = React.useState<Date>(
    value ? new Date(value) : new Date()
  );
  const [open, setOpen] = React.useState(false);
  const [viewDate, setViewDate] = React.useState<Date>(
    value ? new Date(value) : new Date()
  );

  React.useEffect(() => {
    if (value) {
      const newDate = new Date(value);
      setDate(newDate);
      setViewDate(newDate);
    }
  }, [value]);

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = setMonth(viewDate, monthIndex);
    // Always set to first day of month to avoid overflow issues (e.g. Feb 30)
    const firstDayOfMonth = startOfMonth(newDate);
    
    setDate(firstDayOfMonth);
    onValueChange?.(format(firstDayOfMonth, 'yyyy-MM-dd'));
    setOpen(false);
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    const firstDayOfMonth = startOfMonth(now);
    setDate(firstDayOfMonth);
    setViewDate(firstDayOfMonth);
    onValueChange?.(format(firstDayOfMonth, 'yyyy-MM-dd'));
    setOpen(false);
  };

  const handleYearChange = (increment: number) => {
    setViewDate(prev => addYears(prev, increment));
  };

  const formatDisplayDate = (date: Date) => {
    if (!value) return null;
    
    const year = date.getFullYear();
    const displayYear = locale === 'th' ? year + 543 : year;
    const monthName = format(date, 'MMMM', { locale: dateFnsLocale });
    
    return `${monthName} ${displayYear}`;
  };

  const formatYear = (date: Date) => {
    const year = date.getFullYear();
    return locale === 'th' ? year + 543 : year;
  };

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = setMonth(new Date(), i);
    return format(d, 'MMM', { locale: dateFnsLocale });
  });

  const isMonthDisabled = (monthIndex: number) => {
    if (!minDate) return false;
    const checkDate = startOfMonth(setMonth(viewDate, monthIndex));
    const minDateStart = startOfMonth(minDate);
    return isBefore(checkDate, minDateStart);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? formatDisplayDate(date) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="flex items-center justify-between p-2 border-b">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleYearChange(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="font-semibold">
            {formatYear(viewDate)}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleYearChange(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2 p-2">
          {months.map((month, index) => {
            const isDisabled = isMonthDisabled(index);
            return (
              <Button
                key={month}
                variant={
                  date.getMonth() === index && date.getFullYear() === viewDate.getFullYear()
                    ? "default"
                    : "ghost"
                }
                className="h-9 text-sm"
                onClick={() => !isDisabled && handleMonthSelect(index)}
                disabled={isDisabled}
              >
                {month}
              </Button>
            );
          })}
        </div>
        <div className="p-2 border-t border-border">
          <Button
            variant="ghost"
            className="w-full h-8 text-xs"
            onClick={handleCurrentMonth}
          >
            {tCommon('currentMonth')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
