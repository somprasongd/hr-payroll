# shared-logger

Structured logging with Zap.

## Purpose

- Structured JSON logs
- Log levels (debug, info, error)
- Context-aware logging
- Request tracing

## File: api/shared/common/logger/logger.go

```go
package logger

import (
    "context"
    "github.com/google/uuid"
    "go.uber.org/zap"
    "go.uber.org/zap/zapcore"
)

var globalLogger *zap.Logger

type loggerKey struct{}

// Init initializes global logger
func Init(appName string) (func(), error) {
    config := zap.NewProductionConfig()
    config.EncoderConfig.TimeKey = "timestamp"
    config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
    
    logger, err := config.Build(
        zap.Fields(zap.String("app", appName)),
    )
    if err != nil {
        return nil, err
    }
    
    globalLogger = logger
    return func() { _ = globalLogger.Sync() }, nil
}

// Log returns global logger
func Log() *zap.Logger {
    if globalLogger == nil {
        return zap.NewNop()
    }
    return globalLogger
}

// FromContext gets logger from context
func FromContext(ctx context.Context) *zap.Logger {
    if ctx == nil {
        return Log()
    }
    if l, ok := ctx.Value(loggerKey{}).(*zap.Logger); ok {
        return l
    }
    return Log()
}

// WithContext adds logger to context
func WithContext(ctx context.Context, logger *zap.Logger) context.Context {
    return context.WithValue(ctx, loggerKey{}, logger)
}

// WithRequestID adds request ID to logger
func WithRequestID(ctx context.Context, requestID uuid.UUID) context.Context {
    logger := FromContext(ctx).With(zap.String("request_id", requestID.String()))
    return WithContext(ctx, logger)
}
```

## Usage

```go
// Global logging
logger.Log().Info("server started", zap.Int("port", 8080))
logger.Log().Error("database error", zap.Error(err))

// Context-aware logging
logger.FromContext(ctx).Info("processing request",
    zap.String("user_id", userID.String()),
)

// With fields
ctx := logger.WithRequestID(ctx, uuid.New())
logger.FromContext(ctx).Info("request processed")
```

## Log Levels

```go
logger.Log().Debug("debug info")      // Development only
logger.Log().Info("normal operation")
logger.Log().Warn("unexpected but handled")
logger.Log().Error("error occurred")  // Always log
```

## Common Pitfalls

**Incorrect: String concatenation**
```go
// ❌ Not searchable, not structured
log.Printf("User %s logged in from %s", userID, ip)
```

**Correct: Structured fields**
```go
// ✅ Searchable, structured
logger.Log().Info("user logged in",
    zap.String("user_id", userID),
    zap.String("ip", ip),
)
```

**Incorrect: Logging sensitive data**
```go
// ❌ Never log passwords, tokens
logger.Log().Info("login", zap.String("password", password))
```

**Correct: Log safe identifiers**
```go
// ✅ Log IDs, not sensitive data
logger.Log().Info("login attempt", zap.String("user_id", userID))
```
