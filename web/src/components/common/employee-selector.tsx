import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Employee } from "@/services/employee.service";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { EmployeePhoto } from "@/components/common/employee-photo";

interface EmployeeSelectorProps {
  employees: Employee[];
  selectedEmployeeId: string;
  onSelect: (id: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  filterType?: 'all' | 'ft' | 'pt';
}

export function EmployeeSelector({
  employees,
  selectedEmployeeId,
  onSelect,
  placeholder,
  searchPlaceholder,
  emptyText,
  filterType = 'all',
}: EmployeeSelectorProps) {
  const t = useTranslations('Common');
  const [open, setOpen] = useState(false);
  const [showFT, setShowFT] = useState(true);
  const [showPT, setShowPT] = useState(true);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const typeName = (emp.employeeTypeName || '').toLowerCase();
      const isFT = typeName.includes('full') || typeName.includes('ประจำ');
      const isPT = typeName.includes('part') || typeName.includes('พาร์ท') || typeName.includes('ชั่วคราว');

      if (filterType === 'ft') return isFT;
      if (filterType === 'pt') return isPT;
      
      // filterType === 'all'
      if (isFT && !showFT) return false;
      if (isPT && !showPT) return false;
      
      return true;
    });
  }, [employees, filterType, showFT, showPT]);

  const getEmployeeLabel = (emp: Employee) => {
    let prefix = '';
    let bgColor = 'bg-gray-100 text-gray-800'; // Default color

    if (emp.employeeTypeName) {
      const typeName = emp.employeeTypeName.toLowerCase();
      if (typeName.includes('full') || typeName.includes('ประจำ')) {
        prefix = 'FT';
        bgColor = 'bg-blue-100 text-blue-800';
      } else if (typeName.includes('part') || typeName.includes('พาร์ท') || typeName.includes('ชั่วคราว')) {
        prefix = 'PT';
        bgColor = 'bg-orange-100 text-orange-800';
      } else {
        prefix = emp.employeeTypeName.substring(0, 2).toUpperCase();
      }
    }
    
    return (
      <div className="flex items-center gap-2">
        {prefix && (
          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0 ${bgColor}`}>
            {prefix}
          </span>
        )}
        <EmployeePhoto 
          photoId={emp.photoId} 
          firstName={emp.firstName}
          lastName={emp.lastName}
          size="sm"
          className="shrink-0"
        />
        <span className="truncate">
          {emp.employeeNumber} - {emp.fullNameTh || `${emp.firstName} ${emp.lastName}`}
        </span>
      </div>
    );
  };

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  const currentIndex = filteredEmployees.findIndex(e => e.id === selectedEmployeeId);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < filteredEmployees.length - 1;

  const handlePrevious = () => {
    if (hasPrevious) {
      onSelect(filteredEmployees[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      onSelect(filteredEmployees[currentIndex + 1].id);
    }
  };

  return (
    <div className="flex items-center gap-2 w-full">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handlePrevious}
        disabled={!hasPrevious}
        className="shrink-0"
        title={t('previous')}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex-1 min-w-0">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              {selectedEmployee ? getEmployeeLabel(selectedEmployee) : (placeholder || t('selectEmployee'))}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput placeholder={searchPlaceholder || t('search')} />
              
              {filterType === 'all' && (
                <div className="flex items-center gap-2 p-2 border-b">
                  <span className="text-xs text-muted-foreground ml-1">{t('filter')}:</span>
                  <button
                    onClick={() => setShowFT(!showFT)}
                    className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium transition-colors border",
                      showFT 
                        ? "bg-blue-100 text-blue-800 border-blue-200" 
                        : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                    )}
                  >
                    FT
                  </button>
                  <button
                    onClick={() => setShowPT(!showPT)}
                    className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium transition-colors border",
                      showPT 
                        ? "bg-orange-100 text-orange-800 border-orange-200" 
                        : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                    )}
                  >
                    PT
                  </button>
                </div>
              )}

              <CommandList>
                <CommandEmpty>{emptyText || t('noData')}</CommandEmpty>
                <CommandGroup>
                  {filteredEmployees.map((emp) => (
                    <CommandItem
                      key={emp.id}
                      value={`${emp.employeeNumber} ${emp.fullNameTh} ${emp.firstName} ${emp.lastName}`}
                      onSelect={() => {
                        onSelect(emp.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedEmployeeId === emp.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {getEmployeeLabel(emp)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleNext}
        disabled={!hasNext}
        className="shrink-0"
        title={t('next')}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
