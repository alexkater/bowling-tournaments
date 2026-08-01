ALTER TABLE "email_logs" ADD COLUMN "idempotencyKey" text;--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN "payload" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN "maxAttempts" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN "nextAttemptAt" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN "lockedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN "providerMessageId" text;--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN "updatedAt" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "email_logs"
SET "idempotencyKey" = 'legacy:' || id,
    status = CASE WHEN status = 'pending' THEN 'superseded' ELSE status END,
    error = CASE
      WHEN status = 'pending' THEN 'Legacy log migrated; not queued for delivery'
      ELSE error
    END;--> statement-breakpoint
ALTER TABLE "email_logs" ALTER COLUMN "idempotencyKey" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_idempotencyKey_unique" UNIQUE("idempotencyKey");