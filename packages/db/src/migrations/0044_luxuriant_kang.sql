CREATE TABLE "discussion_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"discussion_id" uuid NOT NULL,
	"author_agent_id" uuid,
	"author_user_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"author_agent_id" uuid,
	"author_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_name" text NOT NULL,
	"input_cost_per_million" integer DEFAULT 0 NOT NULL,
	"output_cost_per_million" integer DEFAULT 0 NOT NULL,
	"cached_input_cost_per_million" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_assignees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_permission_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"is_enabled" boolean NOT NULL,
	"overridden_at" timestamp with time zone DEFAULT now() NOT NULL,
	"overridden_by" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" varchar(50) NOT NULL,
	"target_id" uuid,
	"target_type" varchar(50) NOT NULL,
	"permission_id" uuid,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"is_system_permission" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permission_definitions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"is_overrideable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_system_role" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "fallback_config" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "max_concurrent_agents" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "logo_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "system_prompt_md" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "system_prompt_updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "fallback_config" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "general" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "progress_percent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussion_comments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussion_comments_discussion_id_discussions_id_fk" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussion_comments_author_agent_id_agents_id_fk" FOREIGN KEY ("author_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_author_agent_id_agents_id_fk" FOREIGN KEY ("author_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_assignees" ADD CONSTRAINT "issue_assignees_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_assignees" ADD CONSTRAINT "issue_assignees_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_assignees" ADD CONSTRAINT "issue_assignees_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_permission_overrides" ADD CONSTRAINT "agent_permission_overrides_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_permission_overrides" ADD CONSTRAINT "agent_permission_overrides_permission_id_permission_definitions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permission_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_role_assignments" ADD CONSTRAINT "agent_role_assignments_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_role_assignments" ADD CONSTRAINT "agent_role_assignments_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_audit_log" ADD CONSTRAINT "permission_audit_log_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permission_definitions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permission_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discussion_comments_discussion_idx" ON "discussion_comments" USING btree ("discussion_id");--> statement-breakpoint
CREATE INDEX "discussion_comments_company_idx" ON "discussion_comments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "discussion_comments_company_discussion_created_at_idx" ON "discussion_comments" USING btree ("company_id","discussion_id","created_at");--> statement-breakpoint
CREATE INDEX "discussion_comments_company_author_discussion_created_at_idx" ON "discussion_comments" USING btree ("company_id","author_user_id","discussion_id","created_at");--> statement-breakpoint
CREATE INDEX "discussions_company_idx" ON "discussions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "discussions_company_created_at_idx" ON "discussions" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "discussions_author_idx" ON "discussions" USING btree ("author_agent_id","author_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "model_prices_model_name_idx" ON "model_prices" USING btree ("model_name");--> statement-breakpoint
CREATE INDEX "issue_assignees_company_issue_idx" ON "issue_assignees" USING btree ("company_id","issue_id");--> statement-breakpoint
CREATE INDEX "issue_assignees_issue_agent_idx" ON "issue_assignees" USING btree ("issue_id","agent_id");--> statement-breakpoint
CREATE INDEX "issue_assignees_agent_idx" ON "issue_assignees" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_permission_overrides_agent" ON "agent_permission_overrides" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_permission_overrides_permission" ON "agent_permission_overrides" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "idx_agent_permission_overrides_enabled" ON "agent_permission_overrides" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "idx_agent_role_assignments_agent" ON "agent_role_assignments" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_role_assignments_role" ON "agent_role_assignments" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_permission_audit_company" ON "permission_audit_log" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_permission_audit_date" ON "permission_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_permission_category" ON "permission_definitions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_permission_name" ON "permission_definitions" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_role_permissions_role" ON "role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_role_permissions_permission" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_role_permission_unique" ON "role_permissions" USING btree ("role_id","permission_id");--> statement-breakpoint
CREATE INDEX "idx_roles_company" ON "roles" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_roles_system" ON "roles" USING btree ("is_system_role");--> statement-breakpoint
CREATE INDEX "idx_roles_archived" ON "roles" USING btree ("archived_at");