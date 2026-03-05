import { z } from 'zod';

export const roleSchema = z.enum(['owner', 'manager', 'agent', 'viewer']);
export type Role = z.infer<typeof roleSchema>;

export const permissionValues = [
  'dashboard.read',
  'drafts.write',
  'decision.compute',
  'incidents.write',
  'ops.write',
  'platform.configure',
  'automation.execute',
  'integration.read.provider'
] as const;

export const permissionSchema = z.enum(permissionValues);
export type Permission = z.infer<typeof permissionSchema>;

export const authContextSchema = z.object({
  userId: z.string().min(1),
  orgId: z.string().min(1),
  role: roleSchema,
  propertyIds: z.array(z.string().min(1)).optional()
});
export type AuthContext = z.infer<typeof authContextSchema>;
