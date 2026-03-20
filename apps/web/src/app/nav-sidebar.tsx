'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { navGroups } from '@/lib/nav-links';
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
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';

type NavLinkComponentProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

type AppSidebarProps = {
  linkComponent?: ComponentType<NavLinkComponentProps>;
  userButton?: ReactNode;
};

function CollapseToggle() {
  const { open } = useSidebar();
  return (
    <SidebarTrigger className="-ml-1 text-slate-400 hover:text-slate-600">
      {open ? (
        <PanelLeftClose className="h-4 w-4" />
      ) : (
        <PanelLeftOpen className="h-4 w-4" />
      )}
    </SidebarTrigger>
  );
}

export function AppSidebar({
  linkComponent: NavLink = Link,
  userButton,
}: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold tracking-tight text-slate-900 group-data-[collapsible=icon]:hidden">
            Walt AI
          </span>
          <CollapseToggle />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + '/');
                const Icon: LucideIcon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={
                        // eslint-disable-next-line react/no-children-prop
                        <NavLink href={item.href} children={null as unknown as ReactNode} />
                      }
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {userButton && (
        <SidebarFooter className="border-t border-sidebar-border p-3">
          {userButton}
        </SidebarFooter>
      )}

      <SidebarRail />
    </Sidebar>
  );
}
