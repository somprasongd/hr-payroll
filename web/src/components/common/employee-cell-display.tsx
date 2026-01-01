"use client";

import { Employee } from "@/services/employee.service";
import { EmployeePhoto } from "@/components/common/employee-photo";

import { EmployeeTypeBadge } from "./employee-type-badge";

interface EmployeeCellDisplayProps {
  employee: Employee;
}

export function EmployeeCellDisplay({ employee }: EmployeeCellDisplayProps) {
  return (
    <div className="flex items-center gap-2">
      <EmployeeTypeBadge typeName={employee.employeeTypeName} />
      <EmployeePhoto
        photoId={employee.photoId}
        firstName={employee.firstName}
        lastName={employee.lastName}
        size="sm"
        className="shrink-0"
      />
      <span className="truncate">
        {employee.employeeNumber} -{" "}
        {employee.fullNameTh || 
          `${employee.firstName} ${employee.lastName}${employee.nickname ? ` (${employee.nickname})` : ""}`}
      </span>
    </div>
  );
}
