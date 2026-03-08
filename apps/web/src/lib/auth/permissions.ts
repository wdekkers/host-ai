import { permissionValues } from '@walt/contracts';

import type { Permission, Role } from '@walt/contracts';

const rolePermissionMap: Record<Role, ReadonlySet<Permission>> = {
  owner: new Set(permissionValues),
  manager: new Set([
    'dashboard.read',
    'drafts.write',
    'decision.compute',
    'incidents.write',
    'ops.write',
    'automation.execute',
    'integration.read.provider',
  ]),
  agent: new Set([
    'dashboard.read',
    'drafts.write',
    'decision.compute',
    'incidents.write',
    'ops.write',
  ]),
  viewer: new Set(['dashboard.read']),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissionMap[role]?.has(permission) ?? false;
}

export function getPermissionForApiRoute(pathname: string, method: string): Permission | null {
  if (pathname === '/api/integrations/hospitable' && method === 'POST') {
    return null;
  }

  if (pathname.startsWith('/api/integrations/hospitable/messages')) {
    return 'integration.read.provider';
  }

  if (pathname.startsWith('/api/integrations/twilio/threads')) {
    return method === 'GET' ? 'integration.read.provider' : 'ops.write';
  }

  if (pathname.startsWith('/api/integrations/status')) {
    return 'integration.read.provider';
  }

  if (!pathname.startsWith('/api/command-center')) {
    return method === 'GET' ? 'dashboard.read' : 'ops.write';
  }

  if (method === 'GET') {
    return 'dashboard.read';
  }

  if (pathname.includes('/command-center/risk') || pathname.includes('/command-center/strategy')) {
    return 'decision.compute';
  }

  if (
    pathname.includes('/command-center/experience-risk') ||
    pathname.includes('/command-center/risk-intelligence')
  ) {
    return 'decision.compute';
  }

  if (pathname.includes('/command-center/incidents/response-plan')) {
    return 'decision.compute';
  }

  if (pathname.includes('/command-center/incidents')) {
    return 'incidents.write';
  }

  if (pathname.includes('/command-center/autopilot')) {
    return 'automation.execute';
  }

  if (pathname.includes('/command-center/rollout')) {
    return 'platform.configure';
  }

  if (pathname.includes('/command-center/onboarding')) {
    return 'platform.configure';
  }

  if (pathname.includes('/command-center/operating-profile')) {
    return 'platform.configure';
  }

  if (pathname.includes('/command-center/property-brain')) {
    return 'platform.configure';
  }

  if (pathname.includes('/command-center/drafts') || pathname.includes('/command-center/queue')) {
    return 'drafts.write';
  }

  if (pathname.startsWith('/api/admin/')) {
    return 'platform.configure';
  }

  return 'ops.write';
}
