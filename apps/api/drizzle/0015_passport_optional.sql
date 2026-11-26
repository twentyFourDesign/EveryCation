ALTER TABLE "users" ALTER COLUMN "passport_country" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "passport_country" DROP NOT NULL;
--> statement-breakpoint
-- Everyone had Nigeria only because it was the default. Ask them instead.
UPDATE "users" SET "passport_country" = NULL;
