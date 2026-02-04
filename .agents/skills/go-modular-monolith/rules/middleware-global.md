# middleware-global

App-level middleware registration.

## Global Middleware Stack

Applied to all routes:

```go
// api/app/application/http.go
func newFiber(cfg config.Config, healthCheck HealthCheck) *fiber.App {
    app := fiber.New(fiber.Config{
        AppName: cfg.AppName,
    })

    // Order matters! Executed top to bottom
    app.Use(middleware.RequestLogger())      // 1. Log all requests
    app.Use(cors.New(cors.Config{...}))      // 2. Handle CORS
    app.Use(recover.New())                   // 3. Catch panics
    app.Use(middleware.ErrorHandler())       // 4. Format errors
    
    return app
}
```

## Common Global Middleware

### Request Logger
```go
app.Use(func(c fiber.Ctx) error {
    start := time.Now()
    err := c.Next()
    duration := time.Since(start)
    
    log.Info("request",
        zap.String("method", c.Method()),
        zap.String("path", c.Path()),
        zap.Int("status", c.Response().StatusCode()),
        zap.Duration("duration", duration),
    )
    return err
})
```

### CORS
```go
app.Use(cors.New(cors.Config{
    AllowOrigins:     cfg.AllowedOrigins,
    AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
    AllowMethods:     []string{"GET", "POST", "PATCH", "PUT", "DELETE"},
    AllowCredentials: true,
}))
```

### Recovery
```go
app.Use(recover.New(recover.Config{
    EnableStackTrace: true,
}))
```

### Error Handler
```go
app.Use(func(c fiber.Ctx) error {
    err := c.Next()
    if err == nil {
        return nil
    }
    
    // Log unexpected errors
    if _, ok := err.(*errs.AppError); !ok {
        logger.Error("unexpected error", zap.Error(err))
    }
    
    return response.ProblemJSON(c, err)
})
```

## Middleware Order Best Practices

1. **Logging first** - Capture all requests
2. **CORS early** - Handle preflight before auth
3. **Recovery before business logic** - Catch panics
4. **Error handler last** - Format all errors

## Common Pitfalls

**Incorrect: Auth before CORS**
```go
// ❌ CORS preflight blocked by auth
app.Use(middleware.Auth(...))
app.Use(cors.New(...))
```

**Correct: CORS before auth**
```go
// ✅ Handles preflight first
app.Use(cors.New(...))
app.Use(middleware.Auth(...))
```

**Incorrect: Recovery at the end**
```go
// ❌ Panics in other middleware not caught
app.Use(middleware.Auth(...))
app.Use(recover.New())
```

**Correct: Recovery early**
```go
// ✅ Catches all panics
app.Use(recover.New())
app.Use(middleware.Auth(...))
```
