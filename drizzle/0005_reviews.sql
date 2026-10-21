-- Landing-page reviews (Studio > Reviews). Additive and idempotent: safe to re-run,
-- touches no existing table or row. Section settings live in site_settings rows
-- (reviewsEnabled, reviewsTitle, ...), so no settings column is added; the section
-- stays hidden until the owner switches it on in Studio.
CREATE TABLE IF NOT EXISTS "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"rating" integer NOT NULL,
	"text" text NOT NULL,
	"review_date" date,
	"photo_url" text,
	"product_id" integer,
	"visible" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_visible_sort_idx" ON "reviews" ("visible", "sort_order");
