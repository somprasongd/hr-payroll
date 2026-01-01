"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EmployeeTypeBadgeProps {
  typeName?: string;
  typeCode?: string; // Optional: can use code directly if available
}

export function EmployeeTypeBadge({ typeName, typeCode }: EmployeeTypeBadgeProps) {
  const t = useTranslations("Employees");

  // Determine label and colors based on name or code
  let prefix = "";
  let bgColor = "bg-gray-100 text-gray-800";
  let fullLabel = typeName || "-";

  const effectiveName = typeCode || typeName || "";
  const lowerName = effectiveName.toLowerCase();

  if (
    lowerName.includes("full") ||
    lowerName.includes("ประจำ") ||
    lowerName === "ft" ||
    lowerName === "full_time"
  ) {
    prefix = "FT";
    bgColor = "bg-blue-100 text-blue-800";
    fullLabel = t("employeeTypes.full_time");
  } else if (
    lowerName.includes("part") ||
    lowerName.includes("พาร์ท") ||
    lowerName.includes("ชั่วคราว") ||
    lowerName === "pt" ||
    lowerName === "part_time"
  ) {
    prefix = "PT";
    bgColor = "bg-orange-100 text-orange-800";
    fullLabel = t("employeeTypes.part_time");
  } else if (effectiveName) {
    prefix = effectiveName.substring(0, 2).toUpperCase();
  }

  if (!prefix) return <span>-</span>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0 cursor-default ${bgColor}`}
        >
          {prefix}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        {fullLabel}
      </TooltipContent>
    </Tooltip>
  );
}
