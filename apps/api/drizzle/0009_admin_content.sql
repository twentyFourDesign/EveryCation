ALTER TABLE "places" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "plan_purchases" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "image_url" text;