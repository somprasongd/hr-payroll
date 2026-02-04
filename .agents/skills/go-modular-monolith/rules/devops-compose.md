# devops-compose

Docker Compose with migration service.

## Purpose

- Local development environment
- Service orchestration
- Database + API + Migration

## File: docker-compose.yml

```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${DB_USER:-user}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-password}
      POSTGRES_DB: ${DB_NAME:-appdb}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5

  migrate:
    image: migrate/migrate:v4.17.0
    volumes:
      - ./migrations:/migrations
    environment:
      DB_DSN: postgres://${DB_USER:-user}:${DB_PASSWORD:-password}@db:5432/${DB_NAME:-appdb}?sslmode=disable
    command: ["-path", "/migrations", "-database", "$${DB_DSN}", "up"]
    depends_on:
      db:
        condition: service_healthy
    restart: on-failure

  api:
    build: ./api
    ports:
      - "8080:8080"
    environment:
      APP_NAME: ${APP_NAME:-api}
      HTTP_PORT: 8080
      DB_DSN: postgres://${DB_USER:-user}:${DB_PASSWORD:-password}@db:5432/${DB_NAME:-appdb}?sslmode=disable
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
    depends_on:
      migrate:
        condition: service_completed_successfully

volumes:
  pgdata:
```

## Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Rebuild after changes
docker-compose up -d --build

# Stop everything
docker-compose down

# Reset (remove volumes)
docker-compose down -v
```

## Production Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

  migrate:
    image: migrate/migrate:v4.17.0
    volumes:
      - ./migrations:/migrations
    environment:
      DB_DSN: postgres://${DB_USER}:${DB_PASSWORD}@db:5432/appdb?sslmode=disable
    command: ["-path", "/migrations", "-database", "$${DB_DSN}", "up"]

  api:
    build: ./api
    environment:
      DB_DSN: postgres://${DB_USER}:${DB_PASSWORD}@db:5432/appdb?sslmode=disable
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

## Common Pitfalls

**Incorrect: No health checks**
```yaml
# ❌ API starts before DB ready
services:
  db:
    image: postgres
  api:
    depends_on:
      - db  # Just started, not ready
```

**Correct: Health checks**
```yaml
# ✅ Wait for DB to be healthy
services:
  db:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready"]
  api:
    depends_on:
      db:
        condition: service_healthy
```
