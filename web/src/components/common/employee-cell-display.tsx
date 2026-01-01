"use client";

import { Employee } from "@/services/employee.service";
import { EmployeePhoto } from "@/components/common/employee-photo";

interface EmployeeCellDisplayProps {
  employee: Employee;
}

export function EmployeeCellDisplay({ employee }: EmployeeCellDisplayProps) {
  let prefix = "";
  let bgColor = "bg-gray-100 text-gray-800";

  if (employee.employeeTypeName) {
    const typeName = employee.employeeTypeName.toLowerCase();
    if (typeName.includes("full") || typeName.includes("ประจำ")) {
      prefix = "FT";
      bgColor = "bg-blue-100 text-blue-800";
    } else if (
      typeName.includes("part") ||
      typeName.includes("พาร์ท") ||
      typeName.includes("ชั่วคราว")
    ) {
      prefix = "PT";
      bgColor = "bg-orange-100 text-orange-800";
    } else {
      prefix = employee.employeeTypeName.substring(0, 2).toUpperCase();
    }
  }

  return (
    <div className="flex items-center gap-2">
      {prefix && (
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0 ${bgColor}`}
        >
          {prefix}
        </span>
      )}
      <EmployeePhoto
        photoId={employee.photoId}
        firstName={employee.firstName}
        lastName={employee.lastName}
        size="sm"
        className="shrink-0"
      />
      <span className="truncate">
        {employee.employeeNumber} -{" "}
        {employee.fullNameTh || `${employee.firstName} ${employee.lastName}`}
      </span>
    </div>
  );
}
