CREATE TABLE "publications" (
	"id" text PRIMARY KEY NOT NULL,
	"draft_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'claimed' NOT NULL,
	"external_url" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "publications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brand_profile" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "campaigns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rate_limit_buckets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "run_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspace_invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspace_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "options" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "run_id" text;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "run_id" text;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "publish_error" text;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "revision_token" text;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "revision_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "schedule_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "publications_draft_idx" ON "publications" USING btree ("draft_id","created_at");--> statement-breakpoint
CREATE INDEX "drafts_due_idx" ON "drafts" USING btree ("status","scheduled_at");