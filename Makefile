# Meta DJ — Makefile

.PHONY: help migrate api web compose-up compose-down

# Defaults (override in environment or on the make command line)
DB ?= meta_dj.local.sqlite

# API service env (override or set via your shell/.env)
DATABASE_URL ?= postgres://meta:meta@localhost:5432/meta_dj?sslmode=disable
STORAGE_ENDPOINT ?= http://localhost:9000
STORAGE_BUCKET ?= meta-dj
STORAGE_ACCESS_KEY_ID ?= meta
STORAGE_SECRET_ACCESS_KEY ?= meta12345
JWT_SECRET ?=

# Web app env
NEXT_PUBLIC_API_BASE_URL ?= http://localhost:8080

help:
	@echo "Common targets:"
	@echo "  migrate        Apply SQLite migrations to local DB ($(DB))"
	@echo "  api            Run Go API locally (uses DATABASE_URL, STORAGE_*)"
	@echo "  web            Run Next.js web app locally (uses NEXT_PUBLIC_API_BASE_URL)"
	@echo "  compose-up     docker compose up --build"
	@echo "  compose-down   docker compose down -v"

migrate:
	bash scripts/migrate-local.sh $(DB)

api:
	cd services/api-go && \
	go mod tidy && \
	DATABASE_URL="$(DATABASE_URL)" \
	STORAGE_ENDPOINT="$(STORAGE_ENDPOINT)" \
	STORAGE_BUCKET="$(STORAGE_BUCKET)" \
	STORAGE_ACCESS_KEY_ID="$(STORAGE_ACCESS_KEY_ID)" \
	STORAGE_SECRET_ACCESS_KEY="$(STORAGE_SECRET_ACCESS_KEY)" \
	JWT_SECRET="$(JWT_SECRET)" \
	go run .

web:
	cd apps/web && \
	npm install && \
	NEXT_PUBLIC_API_BASE_URL="$(NEXT_PUBLIC_API_BASE_URL)" npm run dev

compose-up:
	docker compose up --build

compose-down:
	docker compose down -v


