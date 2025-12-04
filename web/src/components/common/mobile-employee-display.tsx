import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Employee } from '@/services/employee.service';

interface MobileEmployeeDisplayProps {
  employees: Employee[];
  selectedEmployeeId: string;
  onSelect: (id: string) => void;
}

export function MobileEmployeeDisplay({ employees, selectedEmployeeId, onSelect }: MobileEmployeeDisplayProps) {
  const emp = employees.find(e => e.id === selectedEmployeeId);
  if (!emp) return null;

  let prefix = '';
  let bgColor = 'bg-gray-100 text-gray-800';

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

  const currentIndex = employees.findIndex(e => e.id === selectedEmployeeId);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < employees.length - 1;

  const handlePrevious = () => {
    if (hasPrevious) {
      onSelect(employees[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      onSelect(employees[currentIndex + 1].id);
    }
  };

  return (
    <div className="md:hidden bg-white p-2 rounded-lg border border-gray-200 shadow-sm flex items-center">
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePrevious}
        disabled={!hasPrevious}
        className="shrink-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <div className="flex-1 flex items-center justify-center gap-2 min-w-0 overflow-hidden px-2">
          {prefix && (
          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0 ${bgColor}`}>
            {prefix}
          </span>
        )}
        <div className="font-medium truncate text-sm">{emp.employeeNumber} - {emp.fullNameTh || `${emp.firstName} ${emp.lastName}`}</div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleNext}
        disabled={!hasNext}
        className="shrink-0"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
