ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_profile_unique" UNIQUE("organizationId","profileId");--> statement-breakpoint
ALTER TABLE "tournament_players" ADD CONSTRAINT "tournament_players_tournament_profile_unique" UNIQUE("tournamentId","profileId");
