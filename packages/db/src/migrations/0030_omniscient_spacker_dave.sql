ALTER TABLE "agents" ADD COLUMN "fallback_config" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "fallback_config" jsonb DEFAULT '{}'::jsonb;