import { z } from 'zod';

export const taskPrioritySchema = z.enum(['low', 'medium', 'high']);
export const taskStatusSchema = z.enum(['open', 'resolved', 'deleted']);
export const taskAuditActionSchema = z.enum([
  'created',
  'updated',
  'resolved',
  'restored',
  'deleted',
  'category_deleted',
]);

export const taskCategorySchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  color: z.string().nullish(),
  deletedAt: z.string().nullish(),
  createdAt: z.string(),
  createdBy: z.string(),
});

export const taskSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullish(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  categoryId: z.string().uuid().nullish(),
  assigneeId: z.string().nullish(),
  propertyIds: z.array(z.string()),
  dueDate: z.string().nullish(),
  resolvedAt: z.string().nullish(),
  resolvedBy: z.string().nullish(),
  deletedAt: z.string().nullish(),
  deletedBy: z.string().nullish(),
  createdAt: z.string(),
  createdBy: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string(),
});

export const taskAuditEventSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  organizationId: z.string().uuid(),
  action: taskAuditActionSchema,
  changedBy: z.string(),
  changedAt: z.string(),
  delta: z.record(z.unknown()),
});

export const createTaskInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: taskPrioritySchema,
  categoryId: z.string().uuid().optional(),
  assigneeId: z.string().optional(),
  propertyIds: z.array(z.string()).min(1),
  dueDate: z.string().optional(),
});

export const updateTaskInputSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullish(),
  priority: taskPrioritySchema.optional(),
  categoryId: z.string().uuid().nullish(),
  assigneeId: z.string().nullish(),
  propertyIds: z.array(z.string()).min(1).optional(),
  dueDate: z.string().nullish(),
});

export const createTaskCategoryInputSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
});

export const updateTaskCategoryInputSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().nullish(),
});

export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskAuditAction = z.infer<typeof taskAuditActionSchema>;
export type Task = z.infer<typeof taskSchema>;
export type TaskCategory = z.infer<typeof taskCategorySchema>;
export type TaskAuditEvent = z.infer<typeof taskAuditEventSchema>;
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;
export type CreateTaskCategoryInput = z.infer<typeof createTaskCategoryInputSchema>;
export type UpdateTaskCategoryInput = z.infer<typeof updateTaskCategoryInputSchema>;
