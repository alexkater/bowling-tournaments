CREATE TABLE "auth_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"count" integer NOT NULL,
	"windowStartedAt" timestamp with time zone NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"profileId" text NOT NULL,
	"tokenHash" text NOT NULL,
	"type" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"usedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_tokens_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
ALTER TABLE "user_credentials" ADD COLUMN "emailVerifiedAt" timestamp with time zone DEFAULT now();--> statement-breakpoint
UPDATE "user_credentials" SET "emailVerifiedAt" = now() WHERE "emailVerifiedAt" IS NULL;--> statement-breakpoint
ALTER TABLE "user_credentials" ADD COLUMN "authVersion" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_profileId_profiles_id_fk" FOREIGN KEY ("profileId") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_rate_limits_expiry_idx" ON "auth_rate_limits" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "auth_tokens_profile_type_idx" ON "auth_tokens" USING btree ("profileId","type");--> statement-breakpoint
CREATE INDEX "auth_tokens_expiry_idx" ON "auth_tokens" USING btree ("expiresAt");