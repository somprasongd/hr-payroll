include .env
export

ROOT_DIR := $(dir $(realpath $(lastword $(MAKEFILE_LIST))))
APP_DIR  := api/app
BIN_DIR  := $(ROOT_DIR)/bin
GOCACHE_DIR := $(ROOT_DIR)/.cache/go-build

# ถ้า BUILD_VERSION ไม่ถูกเซ็ตใน .env, ให้ใช้ git tag ล่าสุด (ถ้าไม่มี tag จะ fallback เป็น "latest")
BUILD_VERSION := $(or ${BUILD_VERSION}, $(shell git describe --tags --abbrev=0 2>/dev/null || echo "latest"))
BUILD_TIME := $(shell date +"%Y-%m-%dT%H:%M:%S%z")
CHANGELOG_TAG ?= $(BUILD_VERSION)

.PHONY: run-api
run-api:
	cd $(APP_DIR) && \
	GOCACHE=$(GOCACHE_DIR) go run ./cmd/api

.PHONY: run-web
run-web:
	cd web && npm run dev

.PHONY: run
run:
	$(MAKE) -j 2 run-api run-web

.PHONY: build
build:
	mkdir -p $(BIN_DIR)
	cd $(APP_DIR) && \
	GOCACHE=$(GOCACHE_DIR) go build -ldflags \
	"-s -w \
	-X 'hrms/build.Version=${BUILD_VERSION}' \
	-X 'hrms/build.Time=${BUILD_TIME}'" \
	-o $(BIN_DIR)/hr-payroll-api ./cmd/api

.PHONY: image-api
image-api:
	docker build \
	-t hr-payroll-api:${BUILD_VERSION} \
	-f api/Dockerfile \
	--build-arg VERSION=${BUILD_VERSION} \
	--build-context migrations=./migrations \
	./api

.PHONY: image-web
image-web:
	docker build \
	-t hr-payroll-web:${BUILD_VERSION} \
	-f web/Dockerfile \
	web

.PHONY: image
image: image-api image-web

.PHONY: build-image
build-image:
	docker compose -f docker-compose.build.yml build

.PHONY: devup
devup:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

.PHONY: devdown
devdown:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down

.PHONY: devdownv
devdownv:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v

.PHONY: produp
produp:
	docker compose -f docker-compose.prod.yml up -d

.PHONY: produp-build
produp-build: build-image
	IMAGE_PREFIX= docker compose -f docker-compose.prod.yml up -d

.PHONY: proddown
proddown:
	docker compose -f docker-compose.prod.yml down

.PHONY: mgc
# Example: make mgc filename=create_customer
mgc:
	docker run --rm -v $(ROOT_DIR)migrations:/migrations migrate/migrate -verbose create -ext sql -dir /migrations $(filename)

.PHONY: mgu
mgu:
	docker run --rm --network host -v $(ROOT_DIR)migrations:/migrations migrate/migrate -verbose -path=/migrations/ -database "$(DB_DSN)" up

.PHONY: mgd
mgd:
	docker run --rm --network host -v $(ROOT_DIR)migrations:/migrations migrate/migrate -verbose -path=/migrations/ -database $(DB_DSN) down 1

.PHONY: mgv
mgv:
	docker run --rm --network host -v $(ROOT_DIR)migrations:/migrations migrate/migrate -path=/migrations/ -database "$(DB_DSN)" version

.PHONY: mgf
# Usage: make mgf VERSION=20251217215346
mgf:
	docker run --rm --network host -v $(ROOT_DIR)migrations:/migrations migrate/migrate -path=/migrations/ -database "$(DB_DSN)" force $(VERSION)

.PHONY: db-seed
db-seed:
	for f in migrations/dev-seed/[0-9]*.sql; do \
		echo "Running $$f..."; \
		docker exec -i hr-payroll-db-1 psql -U postgres -d hr-payroll-dev < "$$f"; \
	done

.PHONY: db-seed-clear
db-seed-clear:
	docker exec -i hr-payroll-db-1 psql -U postgres -d hr-payroll-dev < migrations/dev-seed/00_clean_data.sql

.PHONY: doc
# Install swag by using: go install github.com/swaggo/swag/v2/cmd/swag@latest
doc:
	cd $(APP_DIR)/cmd/api && \
	swag init \
		-g main.go \
		-o ../../docs \
		-d .,../../application,../../../modules/auth,../../../modules/user,../../../modules/employee,../../../modules/payrollconfig \
		--parseDependency --parseInternal --parseDependencyLevel 3

.PHONY: dbml
# Install swag by using: go install github.com/swaggo/swag/v2/cmd/swag@latest
dbml:
	db2dbml postgres $(DB_DSN) -o ./docs/design/schema.dbml

.PHONY: changelog changelog-unreleased changelog-release
changelog:
	git cliff -o CHANGELOG.md

changelog-unreleased:
	git cliff --unreleased --prepend CHANGELOG.md

# Example: make changelog-release CHANGELOG_TAG=v1.0.0
changelog-release:
	git cliff --unreleased --tag $(CHANGELOG_TAG) --prepend CHANGELOG.md
