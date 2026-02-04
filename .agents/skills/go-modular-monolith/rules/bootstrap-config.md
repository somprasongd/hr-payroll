# bootstrap-config

Environment-based configuration with env tags.

## Why env-based Config

- 12-factor app compliance
- Different configs per environment
- No config files to manage
- Secrets via environment variables

## File: api/app/config/config.go

```go
package config

import (
    "time"
    "github.com/caarlos0/env/v11"
)

type Config struct {
    AppName          string        `env:"APP_NAME" envDefault:"api"`
    HTTPPort         int           `env:"HTTP_PORT" envDefault:"8080"`
    DSN              string        `env:"DB_DSN,required"`
    JWTAccessSecret  string        `env:"JWT_ACCESS_SECRET,required"`
    JWTRefreshSecret string        `env:"JWT_REFRESH_SECRET,required"`
    AccessTokenTTL   time.Duration `env:"JWT_ACCESS_TTL" envDefault:"15m"`
    RefreshTokenTTL  time.Duration `env:"JWT_REFRESH_TTL" envDefault:"720h"`
    GracefulTimeout  time.Duration `env:"GRACEFUL_TIMEOUT" envDefault:"10s"`
    AllowedOrigins   []string      `env:"ALLOWED_ORIGINS" envDefault:"http://localhost:3000" envSeparator:","`
}

func Load() (*Config, error) {
    cfg := &Config{}
    if err := env.Parse(cfg); err != nil {
        return nil, err
    }
    return cfg, nil
}
```

## Environment Variables

```bash
# Required
export DB_DSN="postgres://user:pass@localhost:5432/db?sslmode=disable"
export JWT_ACCESS_SECRET="your-secret-min-32-chars"
export JWT_REFRESH_SECRET="your-refresh-secret-min-32-chars"

# Optional (with defaults)
export APP_NAME="my-api"
export HTTP_PORT=8080
export JWT_ACCESS_TTL=15m
export JWT_REFRESH_TTL=720h
export ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
```

## .env.example File

```bash
# App
APP_NAME=myapp-api
HTTP_PORT=8080

# Database
DB_DSN=postgres://user:password@localhost:5432/appdb?sslmode=disable

# JWT Secrets (generate strong random strings)
JWT_ACCESS_SECRET=change-me-in-production-min-32-chars
JWT_REFRESH_SECRET=change-me-in-production-min-32-chars

# Optional
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=720h
ALLOWED_ORIGINS=http://localhost:3000
```

## Common Pitfalls

**Incorrect: Hardcoded values**
```go
// ❌ Can't change without recompile
dbHost := "localhost"
dbPort := 5432
```

**Correct: Environment variables**
```go
// ✅ Configurable per environment
type Config struct {
    DBHost string `env:"DB_HOST" envDefault:"localhost"`
    DBPort int    `env:"DB_PORT" envDefault:"5432"`
}
```

**Incorrect: Sensitive data in code**
```go
// ❌ Secrets in version control
jwtSecret := "super-secret-key"
```

**Correct: Required env vars**
```go
// ✅ Fails if not set
JWTSecret string `env:"JWT_SECRET,required"`
```
