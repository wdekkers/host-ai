import { permissionValues } from '@walt/contracts';

import type { Permission, Role } from '@walt/contracts';

const rolePermissionMap: Record<Role, ReadonlySet<Permission>> = {
  owner: new Set(permissionValues),
  manager: new Set([
    'today.read',
    'inbox.read',
    'inbox.create',
    'tasks.read',
    'tasks.create',
    'tasks.update',
    'tasks.delete',
    'reservations.read',
    'guests.read',
    'guests.update',
    'properties.read',
    'properties.update',
    'checklists.read',
    'checklists.create',
    'checklists.update',
    'checklists.delete',
    'contacts.read',
    'contacts.create',
    'contacts.update',
    'seo.read',
    'seo.create',
    'seo.update',
    'questions.read',
    'questions.update',
    'settings.read',
    'settings.update',
    'integrations.read',
  ]),
  agent: new Set([
    'today.read',
    'inbox.read',
    'inbox.create',
    'tasks.read',
    'tasks.create',
    'tasks.update',
    'tasks.delete',
    'reservations.read',
    'guests.read',
    'guests.update',
    'checklists.read',
    'checklists.create',
    'checklists.update',
    'checklists.delete',
    'contacts.read',
    'contacts.create',
    'contacts.update',
  ]),
  cleaner: new Set([
    'today.read',
    'checklists.read',
    'checklists.update',
  ]),
  viewer: new Set([
    'today.read',
  ]),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissionMap[role]?.has(permission) ?? false;
}

export function getPermissionForApiRoute(pathname: string, method: string): Permission | null {
  // Public / webhook routes — no permission required
  if (pathname === '/api/integrations/hospitable' && method === 'POST') {
    return null;
  }

  // Integrations
  if (pathname.startsWith('/api/integrations/')) {
    return 'integrations.read';
  }

  // Admin
  if (pathname.startsWith('/api/admin/')) {
    if (method === 'GET') return 'admin.read';
    if (method === 'POST') return 'admin.create';
    if (method === 'PATCH' || method === 'PUT') return 'admin.update';
    if (method === 'DELETE') return 'admin.delete';
    return 'admin.read';
  }

  // Inbox
  if (pathname.startsWith('/api/inbox')) {
    if (method === 'POST') return 'inbox.create';
    return 'inbox.read';
  }

  // Tasks
  if (pathname.startsWith('/api/tasks') || pathname.startsWith('/api/task-suggestions') || pathname.startsWith('/api/task-categories')) {
    if (method === 'GET') return 'tasks.read';
    if (method === 'POST') return 'tasks.create';
    if (method === 'PATCH' || method === 'PUT') return 'tasks.update';
    if (method === 'DELETE') return 'tasks.delete';
    return 'tasks.read';
  }

  // Guests
  if (pathname.startsWith('/api/guests')) {
    if (method === 'GET') return 'guests.read';
    return 'guests.update';
  }

  // Properties
  if (pathname.startsWith('/api/properties')) {
    if (method === 'GET') return 'properties.read';
    return 'properties.update';
  }

  // Checklists (new + legacy)
  if (pathname.startsWith('/api/checklists') || pathname.startsWith('/api/property-checklists')) {
    if (method === 'GET') return 'checklists.read';
    if (method === 'POST') return 'checklists.create';
    if (method === 'PATCH' || method === 'PUT') return 'checklists.update';
    if (method === 'DELETE') return 'checklists.delete';
    return 'checklists.read';
  }

  // Vendor hub
  if (pathname.startsWith('/api/vendor-hub')) {
    if (method === 'GET') return 'contacts.read';
    if (method === 'POST') return 'contacts.create';
    return 'contacts.read';
  }

  // Contacts
  if (pathname.startsWith('/api/contacts') || pathname.startsWith('/api/messaging/contacts')) {
    if (method === 'GET') return 'contacts.read';
    if (method === 'POST') return 'contacts.create';
    if (method === 'PATCH' || method === 'PUT') return 'contacts.update';
    return 'contacts.read';
  }

  // Messages (vendor messages under contacts)
  if (pathname.startsWith('/api/messaging/messages')) {
    if (method === 'POST') return 'contacts.create';
    return 'contacts.read';
  }

  // SEO drafts
  if (pathname.startsWith('/api/command-center/seo-drafts')) {
    if (method === 'GET') return 'seo.read';
    if (method === 'POST') return 'seo.create';
    return 'seo.update';
  }

  // Questions / Q&A
  if (pathname.startsWith('/api/command-center/qa') || pathname.startsWith('/api/command-center/qa-suggestions') || pathname.startsWith('/api/admin/analyze-questions') || pathname.startsWith('/api/admin/property-faqs')) {
    if (method === 'GET') return 'questions.read';
    return 'questions.update';
  }

  // Knowledge
  if (pathname.startsWith('/api/knowledge')) {
    if (method === 'GET') return 'properties.read';
    return 'properties.update';
  }

  // Agent config / settings
  if (pathname.startsWith('/api/agent-config') || pathname.startsWith('/api/command-center/operating-profile') || pathname.startsWith('/api/command-center/onboarding') || pathname.startsWith('/api/command-center/rollout') || pathname.startsWith('/api/command-center/property-brain')) {
    if (method === 'GET') return 'settings.read';
    return 'settings.update';
  }

  // Cron routes are public (handled by middleware)
  if (pathname.startsWith('/api/cron/')) {
    return null;
  }

  // Command center read endpoints (dashboard, priorities, metrics, etc.)
  if (pathname.startsWith('/api/command-center')) {
    return 'today.read';
  }

  // Today page data
  if (pathname.startsWith('/api/reservations') || pathname.startsWith('/api/command-center/priorities')) {
    return 'reservations.read';
  }

  // Fallback: read for GET, write for everything else
  return method === 'GET' ? 'today.read' : 'tasks.update';
}
