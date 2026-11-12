CREATE TABLE "calendar_links" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"account_email" text,
	"refresh_token" text NOT NULL,
	"calendar_id" text NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"name" text PRIMARY KEY NOT NULL,
	"last_run_at" timestamp with time zone NOT NULL,
	"last_ok_at" timestamp with time zone,
	"last_error" text,
	"last_ms" integer DEFAULT 0 NOT NULL,
	"last_did" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_handoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "login_handoffs_codeHash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "sent_reminders" (
	"key" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "broadcasts" ADD COLUMN "send_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "calendar_event_id" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "calendar_dirty" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_sub" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "apple_sub" text;--> statement-breakpoint
ALTER TABLE "calendar_links" ADD CONSTRAINT "calendar_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_handoffs" ADD CONSTRAINT "login_handoffs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_googleSub_unique" UNIQUE("google_sub");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_appleSub_unique" UNIQUE("apple_sub");--> statement-breakpoint
UPDATE "broadcasts" SET "sent_at" = "created_at" WHERE "sent_at" IS NULL;
