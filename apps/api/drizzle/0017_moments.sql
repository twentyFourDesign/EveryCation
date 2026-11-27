CREATE TYPE "public"."moment_kind" AS ENUM('status', 'event', 'trip', 'safety', 'fun');--> statement-breakpoint
ALTER TYPE "public"."report_target" ADD VALUE 'moment';--> statement-breakpoint
ALTER TYPE "public"."report_target" ADD VALUE 'moment_comment';--> statement-breakpoint
CREATE TABLE "moment_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"moment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"status" "content_status" DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moment_likes" (
	"moment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "moment_kind" NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"media_id" uuid,
	"place" text,
	"country_code" text,
	"event_date" date,
	"status" "content_status" DEFAULT 'published' NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "moment_comments" ADD CONSTRAINT "moment_comments_moment_id_moments_id_fk" FOREIGN KEY ("moment_id") REFERENCES "public"."moments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moment_comments" ADD CONSTRAINT "moment_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moment_likes" ADD CONSTRAINT "moment_likes_moment_id_moments_id_fk" FOREIGN KEY ("moment_id") REFERENCES "public"."moments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moment_likes" ADD CONSTRAINT "moment_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moments" ADD CONSTRAINT "moments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moment_comments_idx" ON "moment_comments" USING btree ("moment_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "moment_likes_once_idx" ON "moment_likes" USING btree ("moment_id","user_id");--> statement-breakpoint
CREATE INDEX "moments_feed_idx" ON "moments" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "moments_kind_idx" ON "moments" USING btree ("kind","status","created_at");--> statement-breakpoint
CREATE INDEX "moments_user_idx" ON "moments" USING btree ("user_id");