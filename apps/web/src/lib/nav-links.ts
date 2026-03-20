import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Inbox,
  CheckSquare,
  CalendarDays,
  Building2,
  ClipboardList,
  BookUser,
  Search,
  HelpCircle,
  Settings,
  Wrench,
} from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
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
      { label: 'Inbox', href: '/inbox', icon: Inbox },
      { label: 'Tasks', href: '/tasks', icon: CheckSquare },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Reservations', href: '/reservations', icon: CalendarDays },
      { label: 'Properties', href: '/properties', icon: Building2 },
      { label: 'Checklists', href: '/property-checklists', icon: ClipboardList },
      { label: 'Contacts', href: '/contacts', icon: BookUser },
    ],
  },
  {
    label: 'Content',
    items: [
      { label: 'SEO Drafts', href: '/seo-drafts', icon: Search },
      { label: 'Questions', href: '/questions', icon: HelpCircle },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings', href: '/settings', icon: Settings },
      { label: 'Admin', href: '/admin/vendors', icon: Wrench },
    ],
  },
];
