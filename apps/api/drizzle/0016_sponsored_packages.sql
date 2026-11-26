CREATE TABLE "advertisers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'agency' NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"whatsapp" text,
	"website" text,
	"sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "travel_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"advertiser_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"destination" text NOT NULL,
	"country_code" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"nights" integer NOT NULL,
	"price" bigint NOT NULL,
	"price_note" text DEFAULT '' NOT NULL,
	"includes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"excludes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"itinerary" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"vibe" text,
	"image_key" text,
	"image_url" text,
	"plan" text DEFAULT 'listing' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"ad_starts" date NOT NULL,
	"ad_ends" date,
	"travel_from" date,
	"travel_to" date,
	"whatsapp" text,
	"phone" text,
	"website" text,
	"sample_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "travel_packages_sampleKey_unique" UNIQUE("sample_key"),
	CONSTRAINT "packages_price_positive" CHECK ("travel_packages"."price" > 0),
	CONSTRAINT "packages_nights" CHECK ("travel_packages"."nights" >= 0)
);
--> statement-breakpoint
ALTER TABLE "package_events" ADD CONSTRAINT "package_events_package_id_travel_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."travel_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_packages" ADD CONSTRAINT "travel_packages_advertiser_id_advertisers_id_fk" FOREIGN KEY ("advertiser_id") REFERENCES "public"."advertisers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "package_events_idx" ON "package_events" USING btree ("package_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "packages_live_idx" ON "travel_packages" USING btree ("status","ad_starts");