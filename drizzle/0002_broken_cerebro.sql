ALTER TABLE "run_steps" ALTER COLUMN "model" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "summary" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "brand_snapshot" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "llm_calls" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "finished_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "run_steps" ADD COLUMN "phase" text;