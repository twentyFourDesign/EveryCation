ALTER TABLE "bucket_items" ADD COLUMN "vibe" text;--> statement-breakpoint
ALTER TABLE "bucket_items" ADD COLUMN "place" text;--> statement-breakpoint
ALTER TABLE "bucket_items" ADD COLUMN "country_code" text;--> statement-breakpoint
ALTER TABLE "bucket_items" ADD COLUMN "lat" double precision;--> statement-breakpoint
ALTER TABLE "bucket_items" ADD COLUMN "lng" double precision;--> statement-breakpoint
ALTER TABLE "bucket_items" ADD COLUMN "done_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bucket_items" ADD COLUMN "memory" text;--> statement-breakpoint
-- Dreams already ticked off count as done when they were added.
UPDATE "bucket_items" SET "done_at" = "created_at" WHERE "state" = 'done';
