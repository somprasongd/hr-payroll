# shared-validator

Request validation with go-playground/validator.

## Purpose

- Declarative validation rules
- Automatic error messages
- Reusable validation logic

## File: api/shared/common/validator/validator.go

```go
package validator

import (
    "github.com/go-playground/validator/v10"
    "{project}/api/shared/common/errs"
)

var validate = validator.New()

// Validate struct using tags
func Validate(s interface{}) error {
    if err := validate.Struct(s); err != nil {
        // Return first validation error
        for _, err := range err.(validator.ValidationErrors) {
            return errs.BadRequest("validation failed: " + err.Field())
        }
    }
    return nil
}

// ValidateUUID validates UUID string
func ValidateUUID(s string) error {
    if _, err := uuid.Parse(s); err != nil {
        return errs.BadRequest("invalid uuid format")
    }
    return nil
}

// ValidateEmail basic email validation
func ValidateEmail(email string) error {
    if err := validate.Var(email, "email"); err != nil {
        return errs.BadRequest("invalid email format")
    }
    return nil
}
```

## Usage in Request Body

```go
type RequestBody struct {
    Name     string    `json:"name" validate:"required,min=3,max=100"`
    Email    string    `json:"email" validate:"required,email"`
    Age      int       `json:"age" validate:"gte=0,lte=150"`
    Status   string    `json:"status" validate:"required,oneof=active inactive"`
    Price    float64   `json:"price" validate:"gt=0"`
}

// In endpoint
var req RequestBody
if err := c.Bind().Body(&req); err != nil {
    return errs.BadRequest("invalid request body")
}

if err := validator.Validate(&req); err != nil {
    return err
}
```

## Common Validation Tags

| Tag | Description |
|-----|-------------|
| `required` | Field must have value |
| `min=3` | Minimum length/value |
| `max=100` | Maximum length/value |
| `email` | Valid email format |
| `uuid` | Valid UUID format |
| `gt=0` | Greater than |
| `gte=0` | Greater than or equal |
| `oneof=a b` | Must be one of values |
| `omitempty` | Skip if empty |

## Custom Validation

```go
func init() {
    validate.RegisterValidation("custom", func(fl validator.FieldLevel) bool {
        // Custom validation logic
        return fl.Field().String() == "valid"
    })
}
```

## Common Pitfalls

**Incorrect: Manual validation**
```go
// ❌ Repetitive, error-prone
if len(req.Name) < 3 || len(req.Name) > 100 {
    return errs.BadRequest("name must be 3-100 characters")
}
if !isValidEmail(req.Email) {
    return errs.BadRequest("invalid email")
}
```

**Correct: Struct tags**
```go
// ✅ Declarative, reusable
type RequestBody struct {
    Name  string `validate:"min=3,max=100"`
    Email string `validate:"email"`
}
validator.Validate(&req)
```

**Incorrect: Missing validation**
```go
// ❌ Accepts any input
var req RequestBody
c.Bind().Body(&req)
// No validation!
```

**Correct: Always validate**
```go
// ✅ Validates all rules
if err := validator.Validate(&req); err != nil {
    return err
}
```
