# shared-errs

Domain error types with HTTP status mapping.

## Purpose

- Type-safe error handling
- HTTP status code mapping
- Consistent error responses
- Distinguish expected vs unexpected errors

## File: api/shared/common/errs/errs.go

```go
package errs

import (
    "errors"
    "net/http"
)

type ErrorCode string

const (
    CodeBadRequest    ErrorCode = "bad_request"
    CodeUnauthorized  ErrorCode = "unauthorized"
    CodeForbidden     ErrorCode = "forbidden"
    CodeNotFound      ErrorCode = "not_found"
    CodeConflict      ErrorCode = "conflict"
    CodeUnprocessable ErrorCode = "unprocessable"
    CodeInternal      ErrorCode = "internal_error"
)

type AppError struct {
    Code    ErrorCode
    Message string
    Detail  interface{}
}

func (e *AppError) Error() string {
    return e.Message
}

// Status returns HTTP status code
func (e *AppError) Status() int {
    switch e.Code {
    case CodeBadRequest:
        return http.StatusBadRequest
    case CodeUnauthorized:
        return http.StatusUnauthorized
    case CodeForbidden:
        return http.StatusForbidden
    case CodeNotFound:
        return http.StatusNotFound
    case CodeConflict:
        return http.StatusConflict
    case CodeUnprocessable:
        return http.StatusUnprocessableEntity
    default:
        return http.StatusInternalServerError
    }
}

// Constructor functions

func BadRequest(msg string, detail ...interface{}) *AppError {
    return &AppError{Code: CodeBadRequest, Message: msg, Detail: pickDetail(detail)}
}

func Unauthorized(msg string) *AppError {
    return &AppError{Code: CodeUnauthorized, Message: msg}
}

func Forbidden(msg string) *AppError {
    return &AppError{Code: CodeForbidden, Message: msg}
}

func NotFound(msg string) *AppError {
    return &AppError{Code: CodeNotFound, Message: msg}
}

func Conflict(msg string) *AppError {
    return &AppError{Code: CodeConflict, Message: msg}
}

func Internal(msg string, detail ...interface{}) *AppError {
    return &AppError{Code: CodeInternal, Message: msg, Detail: pickDetail(detail)}
}

func pickDetail(detail []interface{}) interface{} {
    if len(detail) > 0 {
        return detail[0]
    }
    return nil
}

// Type checking

func IsConflict(err error) bool {
    var e *AppError
    if errors.As(err, &e) {
        return e.Code == CodeConflict
    }
    return false
}
```

## Usage

```go
// In handlers
if err != nil {
    return errs.Internal("database error")
}

if !valid {
    return errs.BadRequest("validation failed", validationErrors)
}

if !found {
    return errs.NotFound("user not found")
}

if exists {
    return errs.Conflict("email already exists")
}
```

## Error Checking

```go
err := doSomething()
if err != nil {
    if errors.Is(err, sql.ErrNoRows) {
        return errs.NotFound("record not found")
    }
    
    if errs.IsConflict(err) {
        // Handle conflict specifically
    }
}
```

## Common Pitfalls

**Incorrect: fmt.Errorf for domain errors**
```go
// ❌ Loses type information
return fmt.Errorf("not found")
```

**Correct: Use typed errors**
```go
// ✅ Preserves error type
return errs.NotFound("user not found")
```

**Incorrect: Wrapping without unwrapping**
```go
// ❌ Can't check with errors.Is
return fmt.Errorf("query failed: %w", err)
```

**Correct: Convert to domain error**
```go
// ✅ Checkable and typed
if errors.Is(err, sql.ErrNoRows) {
    return errs.NotFound("user not found")
}
```
