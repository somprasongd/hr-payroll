# bootstrap-server

HTTP server setup with Fiber v3.

## Why Fiber v3

- Fast and lightweight
- Similar API to Express.js
- Built-in middleware support
- Good Swagger integration

## File: api/app/application/http.go

```go
package application

import (
    "context"
    "fmt"
    "net/http"
    "github.com/gofiber/fiber/v3"
    "github.com/gofiber/fiber/v3/middleware/cors"
    "github.com/gofiber/fiber/v3/middleware/recover"
    "{project}/api/shared/common/logger"
    "{project}/api/shared/common/middleware"
    "{project}/api/app/config"
    "{project}/api/app/build"
)

type HTTPServer interface {
    Start()
    Shutdown() error
    Group(prefix string) fiber.Router
}

type httpServer struct {
    config config.Config
    app    *fiber.App
}

func newHTTPServer(cfg config.Config, healthCheck HealthCheck) HTTPServer {
    return &httpServer{
        config: cfg,
        app:    newFiber(cfg, healthCheck),
    }
}

func newFiber(cfg config.Config, healthCheck HealthCheck) *fiber.App {
    app := fiber.New(fiber.Config{
        AppName: cfg.AppName,
    })

    // Middleware stack (order matters!)
    app.Use(middleware.RequestLogger())
    app.Use(cors.New(cors.Config{
        AllowOrigins:     cfg.AllowedOrigins,
        AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Company-ID", "X-Branch-ID"},
        AllowMethods:     []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
        AllowCredentials: true,
    }))
    app.Use(recover.New())
    app.Use(middleware.ErrorHandler())

    // Health check endpoint
    app.Get("/health", func(c fiber.Ctx) error {
        resp := fiber.Map{
            "status":  "ok",
            "app":     cfg.AppName,
            "version": build.Version,
        }

        if healthCheck != nil {
            if err := healthCheck(c.Context()); err != nil {
                resp["status"] = "unhealthy"
                resp["error"] = err.Error()
                return c.Status(http.StatusServiceUnavailable).JSON(resp)
            }
        }

        return c.JSON(resp)
    })

    return app
}

func (s *httpServer) Start() {
    go func() {
        addr := fmt.Sprintf(":%d", s.config.HTTPPort)
        logger.Log().Info(fmt.Sprintf("starting http server on %s", addr))
        if err := s.app.Listen(addr); err != nil && err != http.ErrServerClosed {
            logger.Log().Fatal(fmt.Sprintf("failed to start server: %v", err))
        }
    }()
}

func (s *httpServer) Shutdown() error {
    ctx, cancel := context.WithTimeout(context.Background(), s.config.GracefulTimeout)
    defer cancel()
    return s.app.ShutdownWithContext(ctx)
}

func (s *httpServer) Group(prefix string) fiber.Router {
    return s.app.Group(prefix)
}
```

## Middleware Order

Order matters! Middleware executes in sequence:

1. **RequestLogger** - Log all requests first
2. **CORS** - Handle preflight/options
3. **Recover** - Catch panics
4. **ErrorHandler** - Format errors
5. **Auth/Tenant** - Module-level middleware

## Common Pitfalls

**Incorrect: CORS after auth**
```go
// ❌ CORS won't apply to preflight
app.Use(middleware.Auth(...))  // Blocks preflight
app.Use(cors.New(...))
```

**Correct: CORS before auth**
```go
// ✅ Handles preflight first
app.Use(cors.New(...))
app.Use(middleware.Auth(...))
```

**Incorrect: No recovery middleware**
```go
// ❌ Panic crashes server
app := fiber.New()
// No recover middleware
```

**Correct: Always recover**
```go
// ✅ Catches and logs panics
app.Use(recover.New())
```
