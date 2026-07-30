CREATE TABLE "bracket_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"bracketPoolId" text NOT NULL,
	"tournamentPlayerId" text NOT NULL,
	"entryNumber" integer DEFAULT 1 NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bracket_matches" (
	"id" text PRIMARY KEY NOT NULL,
	"roundId" text NOT NULL,
	"position" integer NOT NULL,
	"player1Id" text,
	"player2Id" text,
	"player1Score" integer,
	"player2Score" integer,
	"winnerId" text,
	"nextMatchId" text,
	"nextMatchPosition" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bracket_pools" (
	"id" text PRIMARY KEY NOT NULL,
	"tournamentId" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'eight_person_forward' NOT NULL,
	"entryFee" integer DEFAULT 0 NOT NULL,
	"maxPlayers" integer DEFAULT 8 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"config" jsonb DEFAULT '{"handicap":false,"allowMultipleEntries":true,"maxEntriesPerPlayer":5,"payoutRatio":0.8,"bracketSize":8}'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bracket_rounds" (
	"id" text PRIMARY KEY NOT NULL,
	"bracketPoolId" text NOT NULL,
	"roundNumber" integer NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" text PRIMARY KEY NOT NULL,
	"tournamentPlayerId" text NOT NULL,
	"gameNumber" integer NOT NULL,
	"rawScore" integer NOT NULL,
	"handicapScore" integer,
	"pins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"profileId" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"stripeAccountId" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"tournamentId" text NOT NULL,
	"tournamentPlayerId" text NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"stripePaymentId" text,
	"stripeTransferId" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"description" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"firstName" text NOT NULL,
	"lastName" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'player' NOT NULL,
	"phone" text,
	"usbcId" text,
	"average" integer,
	"handicap" integer,
	"birthYear" integer,
	"avatarUrl" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sidepot_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"sidepotId" text NOT NULL,
	"tournamentPlayerId" text NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sidepots" (
	"id" text PRIMARY KEY NOT NULL,
	"tournamentId" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"entryFee" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{"handicap":false,"maxEntries":null,"payoutRatio":0.8,"gamesIncluded":[1,2,3],"gender":"all"}'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "squads" (
	"id" text PRIMARY KEY NOT NULL,
	"stageId" text NOT NULL,
	"name" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"startTime" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"laneStart" integer,
	"laneEnd" integer,
	"maxPlayers" integer,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stages" (
	"id" text PRIMARY KEY NOT NULL,
	"tournamentId" text NOT NULL,
	"name" text NOT NULL,
	"sortOrder" integer NOT NULL,
	"format" jsonb NOT NULL,
	"advancement" jsonb NOT NULL,
	"squadConfig" jsonb,
	"standingsScope" text DEFAULT 'per_squad' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_players" (
	"id" text PRIMARY KEY NOT NULL,
	"tournamentId" text NOT NULL,
	"profileId" text NOT NULL,
	"squadId" text NOT NULL,
	"teamId" text,
	"lane" integer,
	"checkedIn" boolean DEFAULT false NOT NULL,
	"eventEntries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"category" text DEFAULT 'open' NOT NULL,
	"centerId" text,
	"maxPlayers" integer,
	"allowWaitlist" boolean DEFAULT true NOT NULL,
	"startDate" timestamp with time zone NOT NULL,
	"endDate" timestamp with time zone NOT NULL,
	"registrationDeadline" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bracket_entries" ADD CONSTRAINT "bracket_entries_bracketPoolId_bracket_pools_id_fk" FOREIGN KEY ("bracketPoolId") REFERENCES "public"."bracket_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_entries" ADD CONSTRAINT "bracket_entries_tournamentPlayerId_tournament_players_id_fk" FOREIGN KEY ("tournamentPlayerId") REFERENCES "public"."tournament_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_matches" ADD CONSTRAINT "bracket_matches_roundId_bracket_rounds_id_fk" FOREIGN KEY ("roundId") REFERENCES "public"."bracket_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_matches" ADD CONSTRAINT "bracket_matches_player1Id_tournament_players_id_fk" FOREIGN KEY ("player1Id") REFERENCES "public"."tournament_players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_matches" ADD CONSTRAINT "bracket_matches_player2Id_tournament_players_id_fk" FOREIGN KEY ("player2Id") REFERENCES "public"."tournament_players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_matches" ADD CONSTRAINT "bracket_matches_winnerId_tournament_players_id_fk" FOREIGN KEY ("winnerId") REFERENCES "public"."tournament_players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_pools" ADD CONSTRAINT "bracket_pools_tournamentId_tournaments_id_fk" FOREIGN KEY ("tournamentId") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_rounds" ADD CONSTRAINT "bracket_rounds_bracketPoolId_bracket_pools_id_fk" FOREIGN KEY ("bracketPoolId") REFERENCES "public"."bracket_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_tournamentPlayerId_tournament_players_id_fk" FOREIGN KEY ("tournamentPlayerId") REFERENCES "public"."tournament_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_profileId_profiles_id_fk" FOREIGN KEY ("profileId") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_tournamentId_tournaments_id_fk" FOREIGN KEY ("tournamentId") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_tournamentPlayerId_tournament_players_id_fk" FOREIGN KEY ("tournamentPlayerId") REFERENCES "public"."tournament_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sidepot_entries" ADD CONSTRAINT "sidepot_entries_sidepotId_sidepots_id_fk" FOREIGN KEY ("sidepotId") REFERENCES "public"."sidepots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sidepot_entries" ADD CONSTRAINT "sidepot_entries_tournamentPlayerId_tournament_players_id_fk" FOREIGN KEY ("tournamentPlayerId") REFERENCES "public"."tournament_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sidepots" ADD CONSTRAINT "sidepots_tournamentId_tournaments_id_fk" FOREIGN KEY ("tournamentId") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "squads" ADD CONSTRAINT "squads_stageId_stages_id_fk" FOREIGN KEY ("stageId") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stages" ADD CONSTRAINT "stages_tournamentId_tournaments_id_fk" FOREIGN KEY ("tournamentId") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_players" ADD CONSTRAINT "tournament_players_tournamentId_tournaments_id_fk" FOREIGN KEY ("tournamentId") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_players" ADD CONSTRAINT "tournament_players_profileId_profiles_id_fk" FOREIGN KEY ("profileId") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_players" ADD CONSTRAINT "tournament_players_squadId_squads_id_fk" FOREIGN KEY ("squadId") REFERENCES "public"."squads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;