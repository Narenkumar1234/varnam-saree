CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"percentage" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"min_subtotal" integer DEFAULT 0 NOT NULL,
	"expires_on" date,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
