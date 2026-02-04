# {{PROJECT_NAME}} API
# Makefile for common development tasks

# =============================================================================
# Configuration
# =============================================================================

APP_NAME ?= {{PROJECT_NAME}}-api
DB_DSN ?= postgres://user:password@localhost:5432/{{PROJECT_NAME}}db?sslmode=disable
MIGRATE := migrate -path migrations -database "$(DB_DSN)"

# =============================================================================
# Development
# =============================================================================

.PHONY: dev dev-up dev-down dev-logs

dev-up: ## Start development dependencies (PostgreSQL)
	@echo "Starting PostgreSQL..."
	docker-compose -f docker-compose.dev.yml up -d db
	@echo "Waiting for database to be ready..."
	@sleep 3
	$(MIGRATE) up 2>/dev/null || true

dev-down: ## Stop development dependencies
	docker-compose -f docker-compose.dev.yml down

dev-logs: ## View development logs
	docker-compose -f docker-compose.dev.yml logs -f

dev: dev-up ## Run development server (requires: make dev-up)
	cd api && go run ./app/cmd/api/main.go

# =============================================================================
# Build
# =============================================================================

.PHONY: build build-api build-linux build-image

build-api: ## Build API binary locally
	cd api && go build -o ../bin/api ./app/cmd/api/main.go
	@echo "Binary built: ./bin/api"

build-linux: ## Build API binary for Linux (Docker)
	cd api && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -installsuffix cgo -o ../bin/api-linux ./app/cmd/api/main.go
	@echo "Linux binary built: ./bin/api-linux"

build: build-api ## Build all binaries

build-image: ## Build Docker image
	docker build -t $(APP_NAME):latest ./api

# =============================================================================
# Testing
# =============================================================================

.PHONY: test test-api test-coverage

test: ## Run all tests
	go test -v ./...

test-api: ## Run API tests only
	cd api && go test -v ./...

test-coverage: ## Run tests with coverage report
	go test -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

# =============================================================================
# Database Migrations
# =============================================================================

.PHONY: mgc mgu mgd mgv mgf

mgc: ## Create new migration (usage: make mgc name=create_users_table)
	@if [ -z "$(name)" ]; then \
		echo "Error: name is required. Usage: make mgc name=create_users_table"; \
		exit 1; \
	fi
	migrate create -ext sql -dir migrations -seq $(name)
	@echo "Migration files created in migrations/"

mgu: ## Run migrations up
	$(MIGRATE) up

mgd: ## Run migrations down (1 step)
	$(MIGRATE) down 1

mgv: ## Check current migration version
	$(MIGRATE) version

mgf: ## Force migration version (usage: make mgf version=001)
	@if [ -z "$(version)" ]; then \
		echo "Error: version is required. Usage: make mgf version=001"; \
		exit 1; \
	fi
	$(MIGRATE) force $(version)

# =============================================================================
# Documentation
# =============================================================================

.PHONY: swagger swagger-serve

swagger: ## Generate Swagger documentation
	cd api && swag init -g app/cmd/api/main.go -o app/docs
	@echo "Swagger docs generated in api/app/docs/"

swagger-serve: swagger ## Generate and serve Swagger docs
	cd api/app/docs && python3 -m http.server 8081 || python -m http.server 8081

# =============================================================================
# Docker Deployment
# =============================================================================

.PHONY: docker-up docker-down docker-logs docker-build

docker-up: ## Start production stack with Docker Compose
	docker-compose -f docker-compose.yml up -d

docker-down: ## Stop production stack
	docker-compose -f docker-compose.yml down

docker-logs: ## View production logs
	docker-compose -f docker-compose.yml logs -f

docker-build: ## Build all Docker images
	docker-compose -f docker-compose.yml build

docker-deploy: docker-build docker-up ## Build and deploy

# =============================================================================
# Code Quality
# =============================================================================

.PHONY: fmt lint vet tidy clean

fmt: ## Format Go code
	go fmt ./...
	cd api && go fmt ./...

lint: ## Run golangci-lint
	golangci-lint run ./...

vet: ## Run go vet
	go vet ./...

tidy: ## Tidy all go.mod files
	cd api && go mod tidy
	cd api/shared/common && go mod tidy
	cd api/shared/events && go mod tidy
	cd api/shared/contracts && go mod tidy

clean: ## Clean build artifacts
	rm -rf bin/
	rm -f coverage.out coverage.html

# =============================================================================
# Utility
# =============================================================================

.PHONY: install-tools help

install-tools: ## Install development tools (migrate, swag, golangci-lint)
	go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
	go install github.com/swaggo/swag/cmd/swag@latest
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	@echo "Development tools installed"

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
