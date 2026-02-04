# Project Templates

These templates are copied when creating a new API project via `bootstrap-structure`.

## Files

| Template | Destination | Description |
|----------|-------------|-------------|
| `go.work` | `./go.work` | Go workspace configuration |
| `Makefile` | `./Makefile` | Development commands |
| `Dockerfile` | `./api/Dockerfile` | Multi-stage API build |
| `docker-compose.yml` | `./docker-compose.yml` | Production stack |
| `docker-compose.dev.yml` | `./docker-compose.dev.yml` | Development database |
| `nginx.conf` | `./nginx/nginx.conf` | Reverse proxy config |
| `.env.example` | `./.env.example` | Environment template |

## Usage

Templates use `{{PROJECT_NAME}}` placeholder which is replaced during project creation:

```bash
# Copy templates
cp assets/templates/* ./

# Replace placeholder with project name
sed -i '' 's/{{PROJECT_NAME}}/myapp/g' Makefile docker-compose*.yml nginx.conf .env.example
```

## Makefile Commands

| Command | Description |
|---------|-------------|
| `make dev` | Run development server |
| `make dev-up` | Start PostgreSQL in Docker |
| `make build` | Build API binary |
| `make build-image` | Build Docker image |
| `make test` | Run tests |
| `make mgc name=xxx` | Create migration |
| `make mgu` | Run migrations up |
| `make swagger` | Generate Swagger docs |
| `make docker-up` | Deploy with Docker Compose |

## Docker Services

### Production (`docker-compose.yml`)
- `db` - PostgreSQL 16
- `migrate` - Migration runner
- `api` - Go API server
- `nginx` - Reverse proxy

### Development (`docker-compose.dev.yml`)
- `db` - PostgreSQL 16 (port 5432)
