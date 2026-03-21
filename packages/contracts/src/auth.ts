import { z } from 'zod';

export const roleSchema = z.enum(['owner', 'manager', 'agent', 'cleaner', 'viewer']);
export type Role = z.infer<typeof roleSchema>;

export const permissionValues = [
  // Today / dashboard
  'today.read',
  // Inbox
  'inbox.read',
  'inbox.create',
  // Tasks
  'tasks.read',
  'tasks.create',
  'tasks.update',
  'tasks.delete',
  // Reservations
  'reservations.read',
  // Properties
  'properties.read',
  'properties.update',
  // Checklists
  'checklists.read',
  'checklists.create',
  'checklists.update',
  'checklists.delete',
  // Contacts
  'contacts.read',
  'contacts.create',
  'contacts.update',
  // SEO
  'seo.read',
  'seo.create',
  'seo.update',
  // Questions / FAQ
  'questions.read',
  'questions.update',
  // Settings
  'settings.read',
  'settings.update',
  // Admin
  'admin.read',
  'admin.create',
  'admin.update',
  'admin.delete',
  // Integrations
  'integrations.read',
] as const;

export const permissionSchema = z.enum(permissionValues);
export type Permission = z.infer<typeof permissionSchema>;

export const authContextSchema = z.object({
  userId: z.string().min(1),
  orgId: z.string().min(1),
  role: roleSchema,
  propertyIds: z.array(z.string().min(1)).optional(),
});
export type AuthContext = z.infer<typeof authContextSchema>;
