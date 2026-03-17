export type NavLink = {
  href: string;
  label: string;
  icon?: string;
};

export const navLinks: NavLink[] = [
  { href: '/inbox', label: 'Inbox', icon: '💬' },
  { href: '/contacts', label: 'Contacts', icon: '📋' },
  { href: '/tasks', label: 'Tasks', icon: '✅' },
  { href: '/property-checklists', label: 'Property Checklists', icon: '🏠' },
  { href: '/reservations', label: 'Reservations', icon: '📋' },
  { href: '/properties', label: 'Properties', icon: '🏠' },
  { href: '/questions', label: 'Questions', icon: '❓' },
  { href: '/admin/vendors', label: 'Vendors', icon: '📋' },
];
