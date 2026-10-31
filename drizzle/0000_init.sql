CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_role_ck" CHECK ("admin_users"."role" IN ('admin','editor'))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "development_images" (
	"development_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" text DEFAULT 'photo' NOT NULL,
	"caption" text,
	CONSTRAINT "development_images_development_id_media_id_pk" PRIMARY KEY("development_id","media_id"),
	CONSTRAINT "development_images_kind_ck" CHECK ("development_images"."kind" IN ('photo','render','plan')),
	CONSTRAINT "development_images_position_ck" CHECK ("development_images"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "developments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"tagline" text,
	"summary" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"area" text NOT NULL,
	"city" text DEFAULT 'Addis Ababa' NOT NULL,
	"address_note" text,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"location_precision" text,
	"building_type" text NOT NULL,
	"building_config" text,
	"construction_stage" text DEFAULT 'not_confirmed' NOT NULL,
	"construction_note" text,
	"delivery_estimate" text,
	"unit_size_min" numeric(8, 2),
	"unit_size_max" numeric(8, 2),
	"amenities" text[] DEFAULT '{}'::text[] NOT NULL,
	"finishing_options" text[] DEFAULT '{}'::text[] NOT NULL,
	"brochure_url" text,
	"price_mode" text DEFAULT 'on_request' NOT NULL,
	"price_amount" numeric(16, 2),
	"price_currency" text,
	"cover_media_id" uuid,
	"seo_title" text,
	"seo_description" text,
	"og_media_id" uuid,
	"source_url" text,
	"review_notes" text,
	"verified_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "developments_status_ck" CHECK ("developments"."status" IN ('draft','published','archived')),
	CONSTRAINT "developments_building_type_ck" CHECK ("developments"."building_type" IN ('residential','commercial','mixed_use')),
	CONSTRAINT "developments_stage_ck" CHECK ("developments"."construction_stage" IN ('not_confirmed','pre_construction','excavation','structure','finishing','completed','on_hold')),
	CONSTRAINT "developments_slug_ck" CHECK ("developments"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "developments_coords_ck" CHECK (("developments"."latitude" IS NULL) = ("developments"."longitude" IS NULL) AND ("developments"."latitude" IS NULL) = ("developments"."location_precision" IS NULL)),
	CONSTRAINT "developments_lat_lng_range_ck" CHECK ("developments"."latitude" IS NULL OR ("developments"."latitude" BETWEEN -90 AND 90 AND "developments"."longitude" BETWEEN -180 AND 180)),
	CONSTRAINT "developments_size_range_ck" CHECK ("developments"."unit_size_min" IS NULL OR "developments"."unit_size_max" IS NULL OR "developments"."unit_size_min" <= "developments"."unit_size_max"),
	CONSTRAINT "developments_price_ck" CHECK (("developments"."price_mode" = 'on_request' AND "developments"."price_amount" IS NULL AND "developments"."price_currency" IS NULL)
        OR ("developments"."price_mode" IN ('fixed','from','per_sqm_from') AND "developments"."price_amount" > 0 AND "developments"."price_currency" IN ('ETB','USD'))),
	CONSTRAINT "developments_published_at_ck" CHECK ("developments"."status" <> 'published' OR "developments"."published_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"type" text NOT NULL,
	"property_id" uuid,
	"development_id" uuid,
	"subject_label" text,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"preferred_contact" text NOT NULL,
	"preferred_date" date,
	"preferred_window" text,
	"message" text DEFAULT '' NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"consent_version" text NOT NULL,
	"source_path" text,
	"ip_hash" text,
	"user_agent" text,
	"status" text DEFAULT 'new' NOT NULL,
	"admin_notes" text,
	"delivery_status" text DEFAULT 'pending' NOT NULL,
	"delivery_attempts" integer DEFAULT 0 NOT NULL,
	"delivery_next_attempt_at" timestamp with time zone DEFAULT now(),
	"delivery_locked_until" timestamp with time zone,
	"delivery_last_error" text,
	"delivered_at" timestamp with time zone,
	"email_sent_at" timestamp with time zone,
	"webhook_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inquiries_type_ck" CHECK ("inquiries"."type" IN ('general','property','development','viewing')),
	CONSTRAINT "inquiries_status_ck" CHECK ("inquiries"."status" IN ('new','contacted','viewing_scheduled','closed','spam')),
	CONSTRAINT "inquiries_delivery_status_ck" CHECK ("inquiries"."delivery_status" IN ('pending','processing','delivered','failed','skipped')),
	CONSTRAINT "inquiries_contact_ck" CHECK ("inquiries"."email" IS NOT NULL OR "inquiries"."phone" IS NOT NULL),
	CONSTRAINT "inquiries_contact_method_ck" CHECK ("inquiries"."preferred_contact" IN ('phone','whatsapp','email','telegram')),
	CONSTRAINT "inquiries_viewing_ck" CHECK ("inquiries"."type" <> 'viewing' OR "inquiries"."preferred_date" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" text NOT NULL,
	"original_filename" text,
	"mime" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"variants" jsonb NOT NULL,
	"dominant_color" text,
	"alt" text DEFAULT '' NOT NULL,
	"credit" text,
	"source_url" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_dimensions_ck" CHECK ("media"."width" > 0 AND "media"."height" > 0 AND "media"."bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"development_id" uuid NOT NULL,
	"title" text NOT NULL,
	"property_type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"availability" text DEFAULT 'available' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"bedrooms" smallint,
	"bathrooms" smallint,
	"size_sqm" numeric(8, 2),
	"size_min_sqm" numeric(8, 2),
	"size_max_sqm" numeric(8, 2),
	"parking_spaces" smallint,
	"price_mode" text DEFAULT 'on_request' NOT NULL,
	"price_amount" numeric(16, 2),
	"price_currency" text,
	"summary" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"highlights" text[] DEFAULT '{}'::text[] NOT NULL,
	"features" text[] DEFAULT '{}'::text[] NOT NULL,
	"cover_media_id" uuid,
	"seo_title" text,
	"seo_description" text,
	"og_media_id" uuid,
	"source_url" text,
	"review_notes" text,
	"verified_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "properties_status_ck" CHECK ("properties"."status" IN ('draft','published','archived')),
	CONSTRAINT "properties_type_ck" CHECK ("properties"."property_type" IN ('apartment','shop','office','penthouse','townhouse','villa')),
	CONSTRAINT "properties_availability_ck" CHECK ("properties"."availability" IN ('available','limited','reserved','sold_out','coming_soon','on_hold')),
	CONSTRAINT "properties_slug_ck" CHECK ("properties"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "properties_bedrooms_ck" CHECK ("properties"."bedrooms" IS NULL OR "properties"."bedrooms" BETWEEN 0 AND 20),
	CONSTRAINT "properties_bathrooms_ck" CHECK ("properties"."bathrooms" IS NULL OR "properties"."bathrooms" BETWEEN 0 AND 20),
	CONSTRAINT "properties_parking_ck" CHECK ("properties"."parking_spaces" IS NULL OR "properties"."parking_spaces" BETWEEN 0 AND 50),
	CONSTRAINT "properties_size_ck" CHECK (("properties"."size_sqm" IS NULL OR "properties"."size_sqm" > 0)
        AND ("properties"."size_min_sqm" IS NULL OR "properties"."size_min_sqm" > 0)
        AND ("properties"."size_min_sqm" IS NULL OR "properties"."size_max_sqm" IS NULL OR "properties"."size_min_sqm" <= "properties"."size_max_sqm")),
	CONSTRAINT "properties_price_ck" CHECK (("properties"."price_mode" = 'on_request' AND "properties"."price_amount" IS NULL AND "properties"."price_currency" IS NULL)
        OR ("properties"."price_mode" IN ('fixed','from','per_sqm_from') AND "properties"."price_amount" > 0 AND "properties"."price_currency" IN ('ETB','USD'))),
	CONSTRAINT "properties_published_at_ck" CHECK ("properties"."status" <> 'published' OR "properties"."published_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "property_images" (
	"property_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" text DEFAULT 'photo' NOT NULL,
	"caption" text,
	CONSTRAINT "property_images_property_id_media_id_pk" PRIMARY KEY("property_id","media_id"),
	CONSTRAINT "property_images_kind_ck" CHECK ("property_images"."kind" IN ('photo','render','plan')),
	CONSTRAINT "property_images_position_ck" CHECK ("property_images"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"bucket" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_bucket_window_start_pk" PRIMARY KEY("bucket","window_start")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"brand_name" text NOT NULL,
	"brand_tagline" text,
	"realtor_name" text,
	"realtor_title" text,
	"realtor_bio" text,
	"realtor_photo_media_id" uuid,
	"phone" text,
	"whatsapp" text,
	"email" text,
	"telegram" text,
	"office_address" text,
	"office_hours" text,
	"relationship_statement" text NOT NULL,
	"developer_name" text NOT NULL,
	"developer_website" text,
	"developer_phone" text,
	"developer_hotline" text,
	"developer_email" text,
	"developer_address" text,
	"social" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"hero_headline" text NOT NULL,
	"hero_subheadline" text,
	"hero_media_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_settings_singleton_ck" CHECK ("site_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "development_images" ADD CONSTRAINT "development_images_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "development_images" ADD CONSTRAINT "development_images_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developments" ADD CONSTRAINT "developments_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developments" ADD CONSTRAINT "developments_og_media_id_media_id_fk" FOREIGN KEY ("og_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_og_media_id_media_id_fk" FOREIGN KEY ("og_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_realtor_photo_media_id_media_id_fk" FOREIGN KEY ("realtor_photo_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_hero_media_id_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_email_uq" ON "admin_users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "development_images_position_uq" ON "development_images" USING btree ("development_id","position");--> statement-breakpoint
CREATE INDEX "development_images_media_idx" ON "development_images" USING btree ("media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "developments_slug_uq" ON "developments" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "developments_public_idx" ON "developments" USING btree ("status","featured","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "inquiries_reference_uq" ON "inquiries" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "inquiries_idempotency_key_uq" ON "inquiries" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "inquiries_fingerprint_uq" ON "inquiries" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "inquiries_inbox_idx" ON "inquiries" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "inquiries_delivery_idx" ON "inquiries" USING btree ("delivery_status","delivery_next_attempt_at");--> statement-breakpoint
CREATE INDEX "inquiries_property_idx" ON "inquiries" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "inquiries_development_idx" ON "inquiries" USING btree ("development_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_storage_key_uq" ON "media" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "media_source_url_uq" ON "media" USING btree ("source_url");--> statement-breakpoint
CREATE UNIQUE INDEX "properties_slug_uq" ON "properties" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "properties_development_idx" ON "properties" USING btree ("development_id");--> statement-breakpoint
CREATE INDEX "properties_public_idx" ON "properties" USING btree ("status","featured","sort_order");--> statement-breakpoint
CREATE INDEX "properties_filter_idx" ON "properties" USING btree ("status","property_type","bedrooms");--> statement-breakpoint
CREATE UNIQUE INDEX "property_images_position_uq" ON "property_images" USING btree ("property_id","position");--> statement-breakpoint
CREATE INDEX "property_images_media_idx" ON "property_images" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "rate_limits_window_idx" ON "rate_limits" USING btree ("window_start");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");