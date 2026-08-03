CREATE TABLE "score_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"tournamentId" text NOT NULL,
	"actorProfileId" text NOT NULL,
	"resourceType" text NOT NULL,
	"resourceId" text NOT NULL,
	"operation" text NOT NULL,
	"previousValue" jsonb,
	"newValue" jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "score_audit_logs" ADD CONSTRAINT "score_audit_logs_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_audit_logs" ADD CONSTRAINT "score_audit_logs_tournamentId_tournaments_id_fk" FOREIGN KEY ("tournamentId") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "score_audit_logs_tournament_created_idx" ON "score_audit_logs" USING btree ("tournamentId","createdAt");--> statement-breakpoint
CREATE INDEX "score_audit_logs_resource_idx" ON "score_audit_logs" USING btree ("resourceType","resourceId");--> statement-breakpoint
CREATE INDEX "score_audit_logs_actor_idx" ON "score_audit_logs" USING btree ("actorProfileId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "games_tournament_player_game_number_uidx" ON "games" USING btree ("tournamentPlayerId","gameNumber");