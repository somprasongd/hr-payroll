'use client';

import { useAuthStore } from "@/store/auth-store";
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from "@/components/language-switcher";
import { useRouter } from "@/i18n/routing";
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
  Search,
  Bell,
  LogOut,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const t = useTranslations();
  const tMenu = useTranslations('Menu');
  const tDashboard = useTranslations('Dashboard');
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: tMenu('dashboard') },
    { id: 'employees', icon: Users, label: tMenu('employeeManagement') },
    { id: 'attendance', icon: Clock, label: tMenu('attendance') },
    { id: 'leave', icon: CalendarDays, label: tMenu('leaveManagement') },
    { id: 'payroll', icon: DollarSign, label: tMenu('payrollExpenses') },
    { id: 'reports', icon: FileText, label: tMenu('reports') },
    { id: 'hr', icon: Briefcase, label: tMenu('humanResources') },
  ];

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
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
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeMenu === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveMenu(item.id);
                if (isMobile) setMobileMenuOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                isActive 
                  ? "bg-blue-50 text-blue-600 font-medium" 
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {(!collapsed || isMobile) && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Settings & Collapse */}
      <div className="border-t border-gray-200 p-3 space-y-1">
        <button
          onClick={() => {
            setActiveMenu('settings');
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
        </button>
        
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

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "hidden md:flex bg-white border-r border-gray-200 transition-all duration-300 flex-col",
          collapsed ? "w-20" : "w-64"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Menu Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex flex-col h-full bg-white">
            <SidebarContent isMobile />
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
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">
              {tMenu(activeMenu)}
            </h1>
            
            <div className="bg-white rounded-lg border border-gray-200 p-6 md:p-12">
              <div className="text-center space-y-4">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
                  {tDashboard('mainContentArea')}
                </h2>
                <p className="text-sm md:text-base text-gray-600 max-w-2xl mx-auto">
                  {tDashboard('mainContentDescription')}
                </p>
                <p className="text-xs md:text-sm text-gray-500 max-w-2xl mx-auto">
                  {tDashboard('mainContentExample')}
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
