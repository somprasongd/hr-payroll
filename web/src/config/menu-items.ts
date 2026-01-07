import {
  LayoutDashboard,
  Users,
  Clock,
  DollarSign,
  CreditCard,
  Settings2,
  Banknote,
  Building2,
  FileText,
  ClipboardList,
  LucideIcon
} from "lucide-react"

export interface SubMenuItem {
  titleKey: string;
  namespace?: string;
  href: string;
}

export interface MenuItem {
  titleKey: string;
  namespace?: string; // Default to 'Menu'
  icon: LucideIcon;
  href?: string; // Optional if it has subitems
  items?: SubMenuItem[];
}

export interface MenuGroup {
  label: string;
  items: MenuItem[];
  roles?: string[]; // If present, user must have one of these roles
  excludedRoles?: string[]; // If present, user must NOT have any of these roles
}

export const menuConfig: MenuGroup[] = [
  {
    label: "Platform",
    excludedRoles: ['superadmin'],
    items: [
      {
        titleKey: "dashboard",
        icon: LayoutDashboard,
        href: "/dashboard"
      },
      {
        titleKey: "employeeManagement",
        icon: Users,
        href: "/employees"
      },
      {
        titleKey: "payroll",
        icon: Banknote,
        href: "/payroll"
      },
      {
        titleKey: "worklog",
        icon: Clock,
        items: [
          { titleKey: "worklogFT", href: "/worklogs/ft" },
          { titleKey: "worklogPT", href: "/worklogs/pt" },
          { titleKey: "payoutPT", href: "/payouts/pt" }
        ]
      },
      {
        titleKey: "compensation",
        icon: DollarSign,
        items: [
          { titleKey: "salaryRaise", href: "/salary-raise" },
          { titleKey: "bonus", href: "/bonuses" }
        ]
      },
      {
        titleKey: "deductions",
        icon: CreditCard,
        items: [
          { titleKey: "salaryAdvance", href: "/salary-advance" },
          { titleKey: "debt", href: "/debt" }
        ]
      }
    ]
  },
  {
    label: "Admin",
    roles: ['admin'],
    items: [
      {
        // Let's just use "admin" and if it misses, it misses. Or I can add `label` prop to override translation.
        titleKey: "admin", 
        namespace: "Common", // 'admin' likely in Common or just use a known key. 
        // Wait, the original code loops over subitems for Admin.
        icon: Settings2,
        items: [
          { titleKey: "orgProfile", namespace: "Nav", href: "/admin/org-profile" },
          { titleKey: "branches", namespace: "Nav", href: "/admin/branches" },
          { titleKey: "departments", namespace: "Nav", href: "/admin/departments" },
          { titleKey: "positions", namespace: "Nav", href: "/admin/positions" },
          { titleKey: "documentTypes", namespace: "Nav", href: "/admin/document-types" },
          { titleKey: "users", href: "/admin/users" },
          { titleKey: "activityLogs", href: "/admin/activity-logs" },
          { titleKey: "settings", href: "/admin/settings" }
        ]
      }
    ]
  },
  {
    label: "Super Admin",
    roles: ['superadmin'],
    items: [
      {
        titleKey: "companies",
        icon: Building2,
        href: "/super-admin/companies"
      },
      {
        titleKey: "documentTypes",
        namespace: "Nav",
        icon: FileText,
        href: "/super-admin/document-types"
      },
      {
        titleKey: "activityLogs",
        icon: ClipboardList,
        href: "/super-admin/activity-logs"
      }
    ]
  }
];
