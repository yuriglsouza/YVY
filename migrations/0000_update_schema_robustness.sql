CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"farm_id" integer NOT NULL,
	"date" timestamp DEFAULT now(),
	"type" text NOT NULL,
	"message" text NOT NULL,
	"sent_to" text,
	"read" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"company" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "farms" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" text NOT NULL,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"size_ha" real NOT NULL,
	"crop_type" text NOT NULL,
	"planting_date" date,
	"harvest_date" date,
	"image_url" text,
	"client_id" integer,
	"is_deforested" boolean DEFAULT false,
	"polygon" jsonb,
	"last_sync_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"farm_id" integer NOT NULL,
	"date" date NOT NULL,
	"ndvi" real NOT NULL,
	"ndwi" real NOT NULL,
	"ndre" real NOT NULL,
	"rvi" real NOT NULL,
	"otci" real,
	"temperature" real,
	"cloud_cover" real DEFAULT 0,
	"satellite_image" text,
	"thermal_image" text,
	"image_bounds" jsonb,
	"regional_ndvi" real,
	"carbon_stock" real,
	"co2_equivalent" real,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"farm_id" integer NOT NULL,
	"date" timestamp DEFAULT now(),
	"content" text NOT NULL,
	"formal_content" text,
	"readings_snapshot" jsonb,
	"source_reading_id" integer
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" text PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"farm_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"due_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password" text,
	"google_id" text,
	"name" text,
	"avatar_url" text,
	"role" text DEFAULT 'user' NOT NULL,
	"subscription_status" text DEFAULT 'trial',
	"subscription_end" timestamp,
	"receive_alerts" boolean DEFAULT true NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"farm_id" integer NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"coordinates" jsonb NOT NULL,
	"area_ha" real DEFAULT 0 NOT NULL,
	"ndvi_avg" real,
	"generated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "farms" ADD CONSTRAINT "farms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;