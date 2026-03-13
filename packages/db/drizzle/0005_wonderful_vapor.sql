CREATE INDEX "task_audit_events_task_id_idx" ON "walt"."task_audit_events" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_categories_organization_id_idx" ON "walt"."task_categories" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tasks_organization_id_idx" ON "walt"."tasks" USING btree ("organization_id");