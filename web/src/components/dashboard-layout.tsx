'use client';

import { useAuthStore } from "@/store/auth-store";
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from "@/components/language-switcher";
import { useRouter, usePathname, Link } from "@/i18n/routing";
import { 
  LogOut,
  Users,
} from "lucide-react";
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
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const tDashboard = useTranslations('Dashboard');
  const { user, logout, setReturnUrl } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    // Save current path and userId before logout for same-user return
    const currentUserId = user?.id;
    const currentPath = pathname;
    
    logout();
    
    // Set returnUrl after logout so same user can return to this page
    if (currentPath && currentPath !== '/' && !currentPath.includes('/login')) {
      setReturnUrl(currentPath, currentUserId);
    }
    
    router.push('/');
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b px-4 bg-white">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
          </div>
          
          <div className="ml-auto flex items-center gap-2 md:gap-4">
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
        <main className="flex-1 p-4 md:p-6 overflow-auto bg-gray-50">
           <div className="max-w-7xl mx-auto">
            {children}
           </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
