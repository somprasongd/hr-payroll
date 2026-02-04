# middleware-error

Centralized error handling.

## Purpose

- Consistent error responses
- Log unexpected errors
- Hide internal details from client
- Format domain errors properly

## File: api/shared/common/middleware/error_handler.go

```go
package middleware

import (
    "github.com/gofiber/fiber/v3"
    "{project}/api/shared/common/errs"
    "{project}/api/shared/common/logger"
    "{project}/api/shared/common/response"
    "go.uber.org/zap"
)

func ErrorHandler() fiber.Handler {
    return func(c fiber.Ctx) error {
        err := c.Next()
        if err == nil {
            return nil
        }
        
        // Log unexpected errors (not domain errors)
        if _, ok := err.(*errs.AppError); !ok {
            logger.FromContext(c.Context()).Error("unexpected error",
                zap.Error(err),
                zap.String("path", c.Path()),
                zap.String("method", c.Method()),
            )
        }
        
        // Return formatted error response
        return response.ProblemJSON(c, err)
    }
}
```

## Response Format

```go
// Domain error (expected)
{
    "type": "about:blank",
    "title": "Bad Request",
    "status": 400,
    "detail": "name is required"
}

// Unexpected error (internal)
{
    "type": "about:blank",
    "title": "Internal Server Error",
    "status": 500,
    "detail": "unexpected error"  // Generic message
}
```

## Registration

```go
// app/application/http.go
func newFiber(cfg config.Config) *fiber.App {
    app := fiber.New()
    
    // Other middleware...
    
    // Error handler last (catches all errors)
    app.Use(middleware.ErrorHandler())
    
    return app
}
```

## Domain Error Types

```go
errs.BadRequest("validation failed")      // 400
errs.Unauthorized("invalid token")        // 401
errs.Forbidden("insufficient permissions") // 403
errs.NotFound("record not found")         // 404
errs.Conflict("already exists")           // 409
errs.Internal("database error")           // 500
```

## Common Pitfalls

**Incorrect: Returning raw errors**
```go
// ❌ Exposes internal details
return err  // "pq: duplicate key value violates unique constraint..."
```

**Correct: Use domain errors**
```go
// ✅ Clean error message
return errs.Conflict("email already exists")
```

**Incorrect: Generic error for everything**
```go
// ❌ Client can't tell what went wrong
return errs.Internal("something went wrong")
```

**Correct: Specific errors**
```go
// ✅ Client can handle appropriately
if !isValidEmail(email) {
    return errs.BadRequest("invalid email format")
}
if emailExists(email) {
    return errs.Conflict("email already registered")
}
```
