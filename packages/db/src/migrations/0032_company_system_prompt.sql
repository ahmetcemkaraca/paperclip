ALTER TABLE "companies"
ADD COLUMN "system_prompt_md" text DEFAULT '' NOT NULL,
ADD COLUMN "system_prompt_updated_at" timestamp with time zone DEFAULT now() NOT NULL;
