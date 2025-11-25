'use client';

import { ProtectedRoute } from "@/components/protected-route";
import { DashboardLayout as DashboardLayoutComponent } from "@/components/dashboard-layout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <DashboardLayoutComponent>
        {children}
      </DashboardLayoutComponent>
    </ProtectedRoute>
  );
}
