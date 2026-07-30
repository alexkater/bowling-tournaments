INSERT INTO "organizations" (
	"id",
	"name",
	"slug",
	"isActive",
	"createdAt",
	"updatedAt"
)
SELECT
	'legacy-org-' || p."id",
	p."firstName" || ' ' || p."lastName" || ' Organization',
	'organization-' || p."id",
	true,
	now(),
	now()
FROM "profiles" p
INNER JOIN "user_credentials" uc ON uc."profileId" = p."id"
WHERE NOT EXISTS (
	SELECT 1
	FROM "organization_members" om
	WHERE om."profileId" = p."id"
)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "organization_members" (
	"id",
	"organizationId",
	"profileId",
	"role",
	"createdAt"
)
SELECT
	'legacy-member-' || p."id",
	'legacy-org-' || p."id",
	p."id",
	'owner',
	now()
FROM "profiles" p
INNER JOIN "user_credentials" uc ON uc."profileId" = p."id"
WHERE NOT EXISTS (
	SELECT 1
	FROM "organization_members" om
	WHERE om."profileId" = p."id"
)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
UPDATE "profiles" p
SET "role" = 'organizer', "updatedAt" = now()
FROM "user_credentials" uc
WHERE uc."profileId" = p."id"
	AND EXISTS (
		SELECT 1
		FROM "organization_members" om
		WHERE om."profileId" = p."id"
			AND om."role" = 'owner'
	);
