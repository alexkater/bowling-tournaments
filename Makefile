.PHONY: dev build test lint clean db-up db-down db-reset db-studio seed

# Development
dev:
	pnpm dev

build:
	pnpm build

test:
	pnpm test

lint:
	pnpm lint

typecheck:
	pnpm typecheck

format:
	pnpm format

clean:
	pnpm clean
	rm -rf node_modules **/*/node_modules **/*/dist **/*/.next

# Database
db-up:
	docker compose up -d postgres

db-down:
	docker compose down

db-reset:
	docker compose down -v
	docker compose up -d postgres
	sleep 2
	pnpm --filter @bowling/db push

db-studio:
	pnpm --filter @bowling/db studio

db-migrate:
	pnpm --filter @bowling/db migrate

db-generate:
	pnpm --filter @bowling/db generate

seed:
	pnpm --filter @bowling/db seed

# Setup
install:
	pnpm install

setup: install db-up db-migrate seed

# E2E (web)
e2e:
	pnpm --filter @bowling/web test:e2e

# Mobile
mobile-ios:
	pnpm --filter @bowling/mobile ios

mobile-android:
	pnpm --filter @bowling/mobile android
