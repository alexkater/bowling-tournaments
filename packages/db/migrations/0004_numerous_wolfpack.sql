CREATE TABLE "email_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"profileId" text,
	"to" text NOT NULL,
	"template" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"sentAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"profileId" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_profileId_profiles_id_fk" FOREIGN KEY ("profileId") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_profileId_profiles_id_fk" FOREIGN KEY ("profileId") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;