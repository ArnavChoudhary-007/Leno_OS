CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"default_timezone" text DEFAULT 'UTC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_slug_uidx" ON "workspaces" USING btree ("slug");
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
INSERT INTO "workspaces" ("id", "name", "slug", "default_timezone")
VALUES ('00000000-0000-4000-8000-000000000001', 'Local workspace', 'local', 'UTC');
--> statement-breakpoint
ALTER TABLE "brand_profile" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "brand_id" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "run_steps" ADD COLUMN "workspace_id" text;--> statement-breakpoint
UPDATE "brand_profile" SET "workspace_id" = '00000000-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;--> statement-breakpoint
UPDATE "campaigns" SET "workspace_id" = '00000000-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;--> statement-breakpoint
UPDATE "campaigns" SET "created_by" = 'system' WHERE "created_by" IS NULL;--> statement-breakpoint
UPDATE "campaigns" SET "brand_id" = (SELECT "id" FROM "brand_profile" ORDER BY "updated_at" DESC LIMIT 1) WHERE "brand_id" IS NULL;--> statement-breakpoint
UPDATE "drafts" SET "workspace_id" = '00000000-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;--> statement-breakpoint
UPDATE "run_steps" SET "workspace_id" = '00000000-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "brand_profile" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ALTER COLUMN "created_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "drafts" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "run_steps" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invites_token_hash_uidx" ON "workspace_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_workspace_user_uidx" ON "workspace_members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_user_uidx" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "brand_profile" ADD CONSTRAINT "brand_profile_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_brand_id_brand_profile_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brand_profile_workspace_uidx" ON "brand_profile" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "campaigns_workspace_created_idx" ON "campaigns" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "drafts_workspace_campaign_idx" ON "drafts" USING btree ("workspace_id","campaign_id");--> statement-breakpoint
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspace_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspace_invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rate_limit_buckets" ENABLE ROW LEVEL SECURITY;
