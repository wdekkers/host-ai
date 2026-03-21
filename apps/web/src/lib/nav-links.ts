import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Inbox,
  CheckSquare,
  HardHat,
  Calendar,
  CalendarDays,
  Building2,
  ClipboardList,
  BookUser,
  Search,
  HelpCircle,
  Settings,
  Wrench,
} from 'lucide-react';

import type { Role } from '@walt/contracts';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Roles allowed to see this item. Omit to show to all authenticated users. */
  roles?: Role[];
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Today', href: '/today', icon: Home },
      { label: 'Inbox', href: '/inbox', icon: Inbox, roles: ['owner', 'manager', 'agent'] },
      { label: 'Tasks', href: '/tasks', icon: CheckSquare, roles: ['owner', 'manager', 'agent'] },
      { label: 'Vendors', href: '/vendors', icon: HardHat, roles: ['owner', 'manager'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Calendar', href: '/calendar', icon: Calendar, roles: ['owner', 'manager', 'agent'] },
      { label: 'Reservations', href: '/reservations', icon: CalendarDays, roles: ['owner', 'manager', 'agent'] },
      { label: 'Properties', href: '/properties', icon: Building2, roles: ['owner', 'manager'] },
      { label: 'Checklists', href: '/property-checklists', icon: ClipboardList, roles: ['owner', 'manager', 'agent', 'cleaner'] },
      { label: 'Contacts', href: '/contacts', icon: BookUser, roles: ['owner', 'manager', 'agent'] },
    ],
  },
  {
    label: 'Content',
    items: [
      { label: 'SEO Drafts', href: '/seo-drafts', icon: Search, roles: ['owner', 'manager'] },
      { label: 'Questions', href: '/questions', icon: HelpCircle, roles: ['owner', 'manager'] },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings', href: '/settings/agent', icon: Settings, roles: ['owner', 'manager'] },
      { label: 'Admin', href: '/admin/vendors', icon: Wrench, roles: ['owner'] },
    ],
  },
];

/** Filter nav groups to only items visible to the given role. */
export function getNavGroupsForRole(role: Role): NavGroup[] {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((group) => group.items.length > 0);
}
