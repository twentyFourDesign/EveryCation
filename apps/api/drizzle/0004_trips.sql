CREATE TYPE "public"."bucket_state" AS ENUM('dream', 'done');--> statement-breakpoint
CREATE TABLE "bucket_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"state" "bucket_state" DEFAULT 'dream' NOT NULL,
	"source" text,
	"image_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itinerary_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"day" date NOT NULL,
	"time" text NOT NULL,
	"title" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"remind" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"place" text NOT NULL,
	"country_code" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"travellers" integer DEFAULT 1 NOT NULL,
	"image_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_dates_in_order" CHECK ("trips"."end_date" >= "trips"."start_date")
);
--> statement-breakpoint
ALTER TABLE "bucket_items" ADD CONSTRAINT "bucket_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bucket_user_idx" ON "bucket_items" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bucket_source_once_idx" ON "bucket_items" USING btree ("user_id","source");--> statement-breakpoint
CREATE INDEX "itinerary_trip_idx" ON "itinerary_items" USING btree ("trip_id","day","time");--> statement-breakpoint
CREATE INDEX "trips_user_idx" ON "trips" USING btree ("user_id","start_date");