# devops-makefile

Makefile commands for development.

## Overview

Project template includes a complete `Makefile`. See template at:
`assets/templates/Makefile`

## Migration Commands

Migration commands are documented in `db-migration-create.md`:
- `make mgc name=xxx` - Create migration
- `make mgu` - Migrate up
- `make mgd` - Migrate down
- `make mgv` - Show version

## Common Commands

| Command | Description |
|---------|-------------|
| `make dev` | Run development server |
| `make dev-up` | Start PostgreSQL in Docker |
| `make build` | Build API binary |
| `make test` | Run tests |
| `make swagger` | Generate Swagger docs |
| `make docker-deploy` | Deploy with Docker Compose |

## Related

- **Migration commands**: See `db-migration-create.md`
- **Project setup**: See `bootstrap-structure.md`
