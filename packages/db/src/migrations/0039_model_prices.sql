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
CREATE UNIQUE INDEX "model_prices_model_name_idx" ON "model_prices" USING btree ("model_name");
