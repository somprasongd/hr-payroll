'use client';

import { useAuthStore } from "@/store/auth-store";
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from "@/components/language-switcher";
import { useRouter, usePathname, Link } from "@/i18n/routing";
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  CalendarDays, 
  DollarSign, 
  FileText, 
  Briefcase, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  LogOut,
  User,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  isMobile?: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  activeMenu: string;
}

function Sidebar({ 
  collapsed, 
  setCollapsed, 
  isMobile = false, 
  setMobileMenuOpen,
  activeMenu,
  user
}: SidebarProps & { user: any }) {
  const tMenu = useTranslations('Menu');
  const menuItems: { 
    id: string; 
    icon: any; 
    label: string; 
    path: string; 
    indent?: boolean;
    disabled?: boolean;
  }[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: tMenu('dashboard'), path: '/dashboard' },
    { id: 'employees', icon: Users, label: tMenu('employeeManagement'), path: '/employees' },
    { id: 'worklog-ft', icon: User, label: tMenu('worklogFT'), path: '/worklogs/ft', indent: true },
    { id: 'worklog-pt', icon: Clock, label: tMenu('worklogPT'), path: '/worklogs/pt', indent: true },
    { id: 'payout-pt', icon: DollarSign, label: tMenu('payoutPT'), path: '/payouts/pt', indent: true },
    { id: 'salary-raise', icon: TrendingUp, label: tMenu('salaryRaise'), path: '/salary-raise' },
    { id: 'bonus', icon: DollarSign, label: tMenu('bonus'), path: '/bonuses' },
  ];

  return (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center justify-center border-b border-gray-200 px-4">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
          <Briefcase className="w-6 h-6 text-white" />
        </div>
        {(!collapsed || isMobile) && (
          <div className="ml-3">
            <div className="font-bold text-sm">HR & Payroll</div>
            <div className="text-xs text-gray-500">System</div>
          </div>
        )}
      </div>

      {/* Menu Items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeMenu === item.id;
          return (
            <Link
              key={item.id}
              href={item.path}
              onClick={() => {
                if (isMobile) setMobileMenuOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                item.indent ? "pl-7" : "",
                item.disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "",
                isActive 
                  ? "bg-blue-50 text-blue-600 font-medium" 
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {(!collapsed || isMobile) && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Settings & Collapse */}
      <div className="border-t border-gray-200 p-3 space-y-1">
        {user?.role === 'admin' && (
          <Link
            href="/admin/users"
            onClick={() => {
              if (isMobile) setMobileMenuOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
              activeMenu === 'users'
                ? "bg-blue-50 text-blue-600 font-medium"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <Users className="w-5 h-5 flex-shrink-0" />
            {(!collapsed || isMobile) && <span>{tMenu('users')}</span>}
          </Link>
        )}
        {user?.role === 'admin' && (
          <Link
            href="/settings"
            onClick={() => {
              if (isMobile) setMobileMenuOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
              activeMenu === 'settings'
                ? "bg-blue-50 text-blue-600 font-medium"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            {(!collapsed || isMobile) && <span>{tMenu('settings')}</span>}
          </Link>
        )}
        
        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5 flex-shrink-0" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5 flex-shrink-0" />
                <span>{tMenu('collapse')}</span>
              </>
            )}
          </button>
        )}
      </div>
    </>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const tDashboard = useTranslations('Dashboard');
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Determine active menu based on pathname
  const getActiveMenu = () => {
    if (pathname === '/dashboard') return 'dashboard';
    if (pathname.startsWith('/settings')) return 'settings';
    if (pathname.startsWith('/employees')) return 'employees';
    if (pathname.startsWith('/worklogs/ft')) return 'worklog-ft';
    if (pathname.startsWith('/worklogs/pt')) return 'worklog-pt';
    if (pathname.startsWith('/payouts/pt')) return 'payout-pt';
    if (pathname.startsWith('/attendance')) return 'attendance';
    if (pathname.startsWith('/leave')) return 'leave';
    if (pathname.startsWith('/payroll')) return 'payroll';
    if (pathname.startsWith('/reports')) return 'reports';
    if (pathname.startsWith('/hr')) return 'hr';
    if (pathname.startsWith('/admin/users')) return 'users';
    if (pathname.startsWith('/salary-raise')) return 'salary-raise';
    return 'dashboard';
  };

  const [activeMenu, setActiveMenu] = useState(getActiveMenu());

  useEffect(() => {
    setActiveMenu(getActiveMenu());
  }, [pathname]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "hidden md:flex bg-white border-r border-gray-200 transition-all duration-300 flex-col",
          collapsed ? "w-20" : "w-64"
        )}
      >
        <Sidebar 
          collapsed={collapsed} 
          setCollapsed={setCollapsed} 
          setMobileMenuOpen={setMobileMenuOpen}
          activeMenu={activeMenu}
          user={user}
        />
      </aside>

      {/* Mobile Menu Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex flex-col h-full bg-white">
            <Sidebar 
              collapsed={false} 
              setCollapsed={setCollapsed} 
              isMobile={true}
              setMobileMenuOpen={setMobileMenuOpen}
              activeMenu={activeMenu}
              user={user}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>

            {/* Logo/Brand for mobile */}
            <div className="md:hidden flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-xs">HR & Payroll</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 md:gap-3 hover:bg-gray-50 rounded-lg p-2 transition-colors">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-blue-600 text-white text-xs">
                      {user?.username?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden sm:block">
                    <div className="text-sm font-medium">{user?.username}</div>
                    <div className="text-xs text-gray-500">{user?.role}</div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{tDashboard('welcome', { name: user?.username || 'User' })}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="sm:hidden px-2 py-1.5">
                  <LanguageSwitcher />
                </div>
                <DropdownMenuSeparator className="sm:hidden" />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <Users className="w-4 h-4 mr-2" />
                    {tDashboard('profile')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  {tDashboard('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
