type NavLink = {
  href: string;
  label: string;
  icon?: string;
};

export const navLinks: readonly NavLink[] = [
  { href: '/inbox', label: 'Inbox' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/settings/agent', label: 'Agent Settings' },
  { href: '/property-checklists', label: 'Property Checklists' },
  { href: '/reservations', label: 'Reservations' },
  { href: '/properties', label: 'Properties' },
  { href: '/seo-drafts', label: 'SEO Drafts' },
  { href: '/questions', label: 'Questions' },
  { href: '/admin/vendors', label: 'Vendors' },
];
