CREATE TABLE "tournament_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"tournamentId" text NOT NULL,
	"organizationId" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"fileName" text NOT NULL,
	"fileSize" integer NOT NULL,
	"mimeType" text DEFAULT 'application/octet-stream' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tournament_documents" ADD CONSTRAINT "tournament_documents_tournamentId_tournaments_id_fk" FOREIGN KEY ("tournamentId") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_documents" ADD CONSTRAINT "tournament_documents_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tournament_documents_tournament_idx" ON "tournament_documents" USING btree ("tournamentId");
