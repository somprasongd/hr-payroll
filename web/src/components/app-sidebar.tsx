"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Users,
  Clock,
  DollarSign,
  TrendingUp,
  Settings,
  User,
  ChevronRight,
  CreditCard,
  Settings2,
  Banknote,
  Building2
} from "lucide-react"
import { useTranslations } from "next-intl"
import { usePathname } from "@/i18n/routing"
import { useAuthStore } from "@/store/auth-store"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Link } from "@/i18n/routing"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const tMenu = useTranslations('Menu')
  const tNav = useTranslations('Nav')
  const pathname = usePathname()
  const { user } = useAuthStore()

  // Helper to check active state
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <img src="/icon-192x192.png" alt="Logo" className="size-6 rounded" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">HR & Payroll</span>
                  <span className="truncate text-xs">System</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarMenu>
            {/* Dashboard */}
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive('/dashboard')} tooltip={tMenu('dashboard')}>
                <Link href="/dashboard">
                  <LayoutDashboard />
                  <span>{tMenu('dashboard')}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Employees */}
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive('/employees')} tooltip={tMenu('employeeManagement')}>
                <Link href="/employees">
                  <Users />
                  <span>{tMenu('employeeManagement')}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Payroll */}
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive('/payroll')} tooltip={tMenu('payroll')}>
                <Link href="/payroll">
                  <Banknote />
                  <span>{tMenu('payroll')}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Work & Pay - Collapsible */}
            <Collapsible asChild defaultOpen={isActive('/worklogs') || isActive('/payouts')} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={tMenu('worklog')}>
                    <Clock />
                    <span>{tMenu('worklog')}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={isActive('/worklogs/ft')}>
                        <Link href="/worklogs/ft">
                          <span>{tMenu('worklogFT')}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={isActive('/worklogs/pt')}>
                        <Link href="/worklogs/pt">
                          <span>{tMenu('worklogPT')}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={isActive('/payouts/pt')}>
                        <Link href="/payouts/pt">
                          <span>{tMenu('payoutPT')}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>

            {/* Compensation - Collapsible */}
            <Collapsible asChild defaultOpen={isActive('/salary-raise') || isActive('/bonuses')} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={tMenu('compensation')}>
                    <DollarSign />
                    <span>{tMenu('compensation')}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={isActive('/salary-raise')}>
                        <Link href="/salary-raise">
                          <span>{tMenu('salaryRaise')}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={isActive('/bonuses')}>
                        <Link href="/bonuses">
                          <span>{tMenu('bonus')}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>

            {/* Deductions - Collapsible (Salary Advance & Debt) */}
            <Collapsible asChild defaultOpen={isActive('/salary-advance') || isActive('/debt')} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={tMenu('deductions')}>
                    <CreditCard />
                    <span>{tMenu('deductions')}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={isActive('/salary-advance')}>
                        <Link href="/salary-advance">
                          <span>{tMenu('salaryAdvance')}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={isActive('/debt')}>
                        <Link href="/debt">
                          <span>{tMenu('debt')}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>

          </SidebarMenu>
        </SidebarGroup>

        {user?.role === 'admin' && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarMenu>
              <Collapsible asChild defaultOpen={isActive('/admin') || isActive('/settings')} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Admin">
                      <Settings2 />
                      <span>Admin</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={isActive('/admin/users')}>
                          <Link href="/admin/users">
                            <span>{tMenu('users')}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={isActive('/admin/org-profile')}>
                          <Link href="/admin/org-profile">
                            <span>{tNav('orgProfile')}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={isActive('/admin/departments')}>
                          <Link href="/admin/departments">
                            <span>{tNav('departments')}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={isActive('/admin/positions')}>
                          <Link href="/admin/positions">
                            <span>{tNav('positions')}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={isActive('/settings')}>
                          <Link href="/settings">
                            <span>{tMenu('settings')}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Footer content if needed */}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
