# bootstrap-main

Application entry point with proper initialization.

## Why Main Structure Matters

Proper initialization order ensures:
- Configuration loaded before dependencies
- Graceful shutdown handling
- Clean dependency injection
- Proper resource cleanup

## File: api/app/cmd/api/main.go

```go
package main

import (
    "context"
    "fmt"
    "os"
    "os/signal"
    "syscall"
    "time"

    "{project}/api/app/application"
    "{project}/api/app/config"
    "{project}/api/shared/common/jwt"
    "{project}/api/shared/common/logger"
    "{project}/api/shared/common/module"
    "{project}/api/shared/common/storage/sqldb"
    "{project}/api/shared/common/storage/sqldb/transactor"
)

// @title {Project} API
// @version 1.0
// @description REST API
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
func main() {
    // 1. Load configuration
    cfg, err := config.Load()
    if err != nil {
        panic(err)
    }

    // 2. Initialize logger
    closeLog, err := logger.Init(cfg.AppName)
    if err != nil {
        panic(err)
    }
    defer closeLog()

    // 3. Connect to database
    dbCtx, closeDB, err := sqldb.NewDBContext(cfg.DSN)
    if err != nil {
        panic(err)
    }
    defer func() {
        if err := closeDB(); err != nil {
            logger.Log().Error(fmt.Sprintf("error closing db: %v", err))
        }
    }()

    // 4. Health check function
    healthCheck := func(ctx context.Context) error {
        ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
        defer cancel()
        return dbCtx.DB().PingContext(ctx)
    }

    // 5. Create application
    app := application.New(*cfg, healthCheck)

    // 6. Setup transaction management
    trans, dbtxCtx := transactor.New(dbCtx.DB(),
        transactor.WithNestedTransactionStrategy(transactor.NestedTransactionsSavepoints))
    mCtx := module.NewModuleContext(trans, dbtxCtx)

    // 7. Initialize services
    tokenSvc := jwt.NewTokenService(cfg.JWTAccessSecret, cfg.JWTRefreshSecret, cfg.AccessTokenTTL, cfg.RefreshTokenTTL)

    // 8. Register modules
    // app.RegisterModules(
    //     example.NewModule(mCtx, tokenSvc),
    // )

    // 9. Start application
    app.Run()

    // 10. Wait for shutdown signal
    stop := make(chan os.Signal, 1)
    signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
    <-stop

    // 11. Graceful shutdown
    _ = app.Shutdown()
}
```

## Initialization Order

1. **Config** - Load environment variables
2. **Logger** - Structured logging setup
3. **Database** - Connection pool
4. **Health Check** - For monitoring
5. **Application** - HTTP server container
6. **Transactor** - Transaction management
7. **Services** - JWT, external APIs
8. **Modules** - Domain modules registration
9. **Start** - Begin accepting requests
10. **Signal** - Wait for interrupt
11. **Shutdown** - Cleanup resources

## Common Pitfalls

**Incorrect: Wrong initialization order**
```go
// ❌ Logger after database (can't log DB errors)
db, _ := sql.Open(...)  // Error not logged!
logger.Init()
```

**Correct: Logger first**
```go
// ✅ Can log all subsequent errors
logger.Init()
db, err := sql.Open(...)
if err != nil {
    logger.Log().Error("db failed", zap.Error(err))
}
```

**Incorrect: Missing graceful shutdown**
```go
// ❌ Abrupt termination
app.Run()
// No cleanup
```

**Correct: Handle shutdown signals**
```go
// ✅ Clean resource release
stop := make(chan os.Signal, 1)
signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
<-stop
app.Shutdown()
```
