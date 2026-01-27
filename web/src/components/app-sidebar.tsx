"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"
import { useTranslations } from "next-intl"
import { usePathname } from "@/i18n/routing"
import { useAuthStore } from "@/store/auth-store"
import { menuConfig, MenuItem, MenuGroup, SubMenuItem } from "@/config/menu-items"
import { API_CONFIG } from "@/config/api"

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
  const tCommon = useTranslations('Common')
  const pathname = usePathname()
  const { user } = useAuthStore()
  const [version, setVersion] = React.useState<string>(process.env.NEXT_PUBLIC_VERSION || '...')

  React.useEffect(() => {
    // If NEXT_PUBLIC_VERSION is set, we use it (it reflects the build version)
    // We still try to fetch from API to get the running API version if it's different
    const apiBase = API_CONFIG.rootURL;
    
    fetch(`${apiBase}/api/version`)
      .then(res => res.json())
      .then(data => {
         if (data.version) {
             setVersion(data.version.replace(/^v/i, ''))
         }
      })
      .catch(() => {
        if (!process.env.NEXT_PUBLIC_VERSION) {
          setVersion('unknown')
        }
      })
  }, [])

  // Helper to check active state
  const isActive = (path?: string) => {
    if (!path) return false;
    return pathname === path || pathname.startsWith(path + '/');
  }

  const getTitle = (key: string, ns?: string) => {
    // Basic fallback for 'Admin' or other direct keys if they exist in Common/Menu
    // or if we want to support raw strings (not implemented in config type yet)
    try {
      switch(ns) {
        case 'Nav': return tNav(key);
        case 'Common': return tCommon(key);
        default: return tMenu(key);
      }
    } catch (e) {
      return key;
    }
  }

  const shouldRenderGroup = (group: MenuGroup) => {
    if (group.excludedRoles && group.excludedRoles.includes(user?.role || '')) {
      return false;
    }
    if (group.roles && !group.roles.includes(user?.role || '')) {
      return false;
    }
    return true;
  }

  const renderMenuItem = (item: MenuItem) => {
    // If it has subitems, render collapsible
    if (item.items && item.items.length > 0) {
      const isChildActive = item.items.some(sub => isActive(sub.href));
      const title = getTitle(item.titleKey, item.namespace);

      return (
        <Collapsible 
          key={item.titleKey} 
          asChild 
          defaultOpen={isChildActive} 
          className="group/collapsible"
        >
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton tooltip={title}>
                <item.icon />
                <span>{title}</span>
                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {item.items.map(sub => (
                  <SidebarMenuSubItem key={sub.href}>
                    <SidebarMenuSubButton asChild isActive={isActive(sub.href)}>
                      <Link href={sub.href}>
                        <span>{getTitle(sub.titleKey, sub.namespace)}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      )
    }

    // Standard item
    if (item.href) {
      const title = getTitle(item.titleKey, item.namespace);
      return (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={title}>
            <Link href={item.href}>
              <item.icon />
              <span>{title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )
    }

    return null;
  }

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
        {menuConfig.map((group, index) => {
          if (!shouldRenderGroup(group)) return null;
          
          return (
            <SidebarGroup key={index}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map(renderMenuItem)}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
             <div className="px-4 py-2 text-xs text-muted-foreground">
               Version: {version}
             </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
