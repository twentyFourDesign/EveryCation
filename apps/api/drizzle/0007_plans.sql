CREATE TYPE "public"."plan_mode" AS ENUM('private', 'free', 'sell');--> statement-breakpoint
ALTER TYPE "public"."ledger_account_kind" ADD VALUE 'creator_payable';--> statement-breakpoint
ALTER TYPE "public"."ledger_account_kind" ADD VALUE 'shop_revenue';--> statement-breakpoint
CREATE TABLE "plan_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"price" bigint NOT NULL,
	"fee" bigint NOT NULL,
	"seller_amount" bigint NOT NULL,
	"transaction_id" uuid,
	"payout_reference" text,
	"paid_out_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"mode" "plan_mode" DEFAULT 'private' NOT NULL,
	"price" bigint DEFAULT 0 NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_tripId_unique" UNIQUE("trip_id"),
	CONSTRAINT "plans_price_not_negative" CHECK ("plans"."price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "plan_purchases" ADD CONSTRAINT "plan_purchases_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_purchases" ADD CONSTRAINT "plan_purchases_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_purchases" ADD CONSTRAINT "plan_purchases_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_purchases" ADD CONSTRAINT "plan_purchases_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_purchase_once_idx" ON "plan_purchases" USING btree ("plan_id","buyer_id");--> statement-breakpoint
CREATE INDEX "plan_purchase_seller_idx" ON "plan_purchases" USING btree ("seller_id","paid_out_at");--> statement-breakpoint
CREATE INDEX "plans_user_idx" ON "plans" USING btree ("user_id");