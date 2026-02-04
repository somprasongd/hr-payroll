# module-endpoint

HTTP endpoint registration with Swagger docs.

## Why Separate Endpoints

- Clean HTTP layer separation
- Swagger documentation per endpoint
- Testable handlers
- Consistent error responses

## File: internal/feature/{action}/endpoint.go

```go
package create

import (
    "github.com/gofiber/fiber/v3"
    "{project}/api/modules/{module}/internal/repository"
    "{project}/api/shared/common/errs"
    "{project}/api/shared/common/mediator"
    "{project}/api/shared/common/response"
)

// RequestBody HTTP request structure
type RequestBody struct {
    Name        string  `json:"name" validate:"required"`
    Description *string `json:"description"`
}

// ToRecord converts request to repository record
func (p RequestBody) ToRecord() repository.Record {
    return repository.Record{
        Name:        p.Name,
        Description: p.Description,
    }
}

// Create resource
// @Summary Create {resource}
// @Description Create a new {resource}
// @Tags {Module}
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body RequestBody true "{resource} payload"
// @Success 201 {object} Response
// @Failure 400 {object} response.Problem
// @Failure 401 {object} response.Problem
// @Failure 403 {object} response.Problem
// @Param X-Company-ID header string true "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /{resources} [post]
func NewEndpoint(router fiber.Router) {
    router.Post("/", func(c fiber.Ctx) error {
        // 1. Parse request body
        var req RequestBody
        if err := c.Bind().Body(&req); err != nil {
            return errs.BadRequest("invalid request body")
        }
        
        // 2. Send command via mediator
        resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
            Payload: req,
        })
        if err != nil {
            return err  // Error handler middleware will format
        }
        
        // 3. Return success response
        return response.JSON(c, fiber.StatusCreated, resp.Detail)
    })
}
```

## List Endpoint Example

```go
package list

import (
    "strconv"
    "github.com/gofiber/fiber/v3"
    "{project}/api/shared/common/mediator"
    "{project}/api/shared/common/response"
)

// List {resources}
// @Summary List {resources}
// @Description List all {resources} with pagination
// @Tags {Module}
// @Produce json
// @Param page query int false "page number"
// @Param limit query int false "items per page"
// @Param search query string false "search term"
// @Security BearerAuth
// @Success 200 {object} Response
// @Failure 401 {object} response.Problem
// @Router /{resources} [get]
func NewEndpoint(router fiber.Router) {
    router.Get("/", func(c fiber.Ctx) error {
        // Parse query params with defaults
        page, _ := strconv.Atoi(c.Query("page", "1"))
        limit, _ := strconv.Atoi(c.Query("limit", "20"))
        search := c.Query("search")
        
        resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
            Page:   page,
            Limit:  limit,
            Search: search,
        })
        if err != nil {
            return err
        }
        
        return response.JSON(c, fiber.StatusOK, resp)
    })
}
```

## Swagger Annotations

| Annotation | Purpose |
|------------|---------|
| `@Summary` | Short description |
| `@Description` | Detailed description |
| `@Tags` | Group in Swagger UI |
| `@Accept` | Request content type |
| `@Produce` | Response content type |
| `@Security` | Auth requirement |
| `@Param` | Parameter documentation |
| `@Success` | Success response schema |
| `@Failure` | Error response schema |
| `@Router` | Path and method |

## Common Pitfalls

**Incorrect: Business logic in endpoint**
```go
// ❌ Don't do this
func NewEndpoint(router fiber.Router) {
    router.Post("/", func(c fiber.Ctx) error {
        // Business logic here!
        result := db.Query(...)
        // ...
    })
}
```

**Correct: Delegate to command/query**
```go
// ✅ Just parse and dispatch
func NewEndpoint(router fiber.Router) {
    router.Post("/", func(c fiber.Ctx) error {
        resp, err := mediator.Send[*Command, *Response](...)
        return response.JSON(c, status, resp)
    })
}
```
