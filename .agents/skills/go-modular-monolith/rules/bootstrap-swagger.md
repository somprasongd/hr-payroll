# bootstrap-swagger

Setup API documentation with Swagger/OpenAPI.

## Prerequisites

Swag v2 supports OpenAPI 3.0 and has improved parser performance.

```bash
# Install swag v2
go install github.com/swaggo/swag/v2/cmd/swag@latest

# Get the v2 packages
go get github.com/swaggo/swag/v2
go get github.com/swaggo/files/v2
# For Fiber v3
go get github.com/swaggo/fiber-swagger/v2
```

## Step 1: Annotate Main Package

```go
// api/app/main.go
// Package main API Server.
//
// @title           API
// @version         1.0.0
// @description     API Server
// @termsOfService  http://example.com/terms

// @contact.name   API Support
// @contact.email  support@example.com

// @license.name  Apache 2.0
// @license.url   http://www.apache.org/licenses/LICENSE-2.0.html

// @host      localhost:8080
// @BasePath  /api/v1
// @schemes   http https

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.

// @tag.name        Auth
// @tag.description Authentication endpoints

// @tag.name        Users
// @tag.description User management

// @tag.name        Products
// @tag.description Product management

func main() {
    // ...
}
```

## Step 2: Annotate Handlers

```go
// ShowAccount godoc
//
// @Summary     Get employee by ID
// @Description Get employee details with related data
// @Tags        Employee
// @Accept      json
// @Produce     json
// @Param       id   path      string true "Employee ID"
// @Success     200  {object}  ResponseBody
// @Failure     400  {object}  ErrorResponse
// @Failure     401  {object}  ErrorResponse
// @Failure     404  {object}  ErrorResponse
// @Failure     500  {object}  ErrorResponse
// @Security    BearerAuth
// @Router      /employees/{id} [get]
func (h *GetHandler) GetByID(c fiber.Ctx) error {
    // ...
}

// CreateEmployee godoc
//
// @Summary     Create new employee
// @Description Create employee with personal info and employment details
// @Tags        Employee
// @Accept      json
// @Produce     json
// @Param       tenant  header    string      true  "Tenant Code"
// @Param       body    body      RequestBody true  "Employee data"
// @Success     201     {object}  ResponseBody
// @Failure     400     {object}  ErrorResponse
// @Failure     401     {object}  ErrorResponse
// @Failure     409     {object}  ErrorResponse  "Duplicate employee code"
// @Security    BearerAuth
// @Router      /employees [post]
func (h *CreateHandler) Handle(c fiber.Ctx) error {
    // ...
}
```

## Step 3: Generate Swagger Docs

```bash
# Generate docs (v2 uses OpenAPI 3.0 by default)
cd api && swag init -g app/main.go -o app/docs

# Generate with OpenAPI 3.1
cd api && swag init -g app/main.go -o app/docs --v3.1

# With dependency parsing
cd api && swag init -g app/main.go -o app/docs --parseDependency --parseInternal
```

## Step 4: Configure Swagger Middleware

```go
// api/app/middleware/swagger.go
package middleware

import (
    "fmt"
    "strings"

    "github.com/gofiber/fiber/v3"
    fiberSwagger "github.com/swaggo/fiber-swagger/v2"
    
    "{project}/api/app/build"
    "{project}/api/app/config"
    "{project}/api/app/docs"
)

// APIDoc returns swagger handler with dynamic configuration.
func APIDoc(cfg config.Config) fiber.Handler {
    host := cfg.GatewayHost
    if host == "" {
        host = fmt.Sprintf("localhost:%d", cfg.HTTPPort)
    }
    // Remove protocol prefix
    host = strings.TrimPrefix(strings.TrimPrefix(host, "https://"), "http://")

    docs.SwaggerInfo.Title = cfg.APITitle
    docs.SwaggerInfo.Version = build.Version
    docs.SwaggerInfo.Host = host
    docs.SwaggerInfo.BasePath = "/api/v1"
    docs.SwaggerInfo.Schemes = []string{"http", "https"}
    
    return fiberSwagger.WrapHandler
}
```

## Step 5: Register in Application

```go
// api/app/main.go
func main() {
    cfg := config.Load()
    app := fiber.New()

    // API docs (no auth required)
    app.Get("/docs/*", middleware.APIDoc(cfg))
    
    // API routes...
    api := app.Group("/api/v1")
    
    log.Fatal(app.Listen(fmt.Sprintf(":%d", cfg.HTTPPort)))
}
```

## Response Types

```go
// api/app/docs/types.go
package docs

// ErrorResponse represents API error response.
type ErrorResponse struct {
    Error   string            `json:"error" example:"Bad Request"`
    Message string            `json:"message" example:"Invalid input data"`
    Details map[string]string `json:"details,omitempty"`
}

// ValidationError represents validation error details.
type ValidationError struct {
    Field   string `json:"field" example:"email"`
    Message string `json:"message" example:"Email is required"`
}
```

## Makefile Targets

```makefile
# api/Makefile

.PHONY: docs docs-watch

# Generate swagger documentation
docs:
	@swag init -g app/main.go -o app/docs

# Watch and regenerate docs
docs-watch:
	@which watchexec > /dev/null 2>&1 || (echo "Installing watchexec..." && cargo install watchexec-cli)
	@watchexec -e go -r "swag init -g app/main.go -o app/docs"

# Clean generated docs
docs-clean:
	@rm -rf app/docs
```

## CI/CD Integration

```yaml
# .github/workflows/api.yml
- name: Verify Swagger docs
  working-directory: ./api
  run: |
    go install github.com/swaggo/swag/cmd/swag@latest
    swag init -g app/main.go -o app/docs
    # Fail if docs are out of sync
    git diff --exit-code app/docs/ || (
      echo "⚠️ Swagger docs are out of sync. Run 'make docs' and commit changes."
      exit 1
    )
```

## Common Annotations

| Annotation | Description | Example |
|------------|-------------|---------|
| `@Summary` | Short endpoint description | "Get user by ID" |
| `@Description` | Long description | "Returns detailed user information" |
| `@Tags` | Grouping in UI | `Employee` |
| `@Param` | Path/query/body param | `id path string true "User ID"` |
| `@Success` | Success response | `200 {object} ResponseBody` |
| `@Failure` | Error response | `400 {object} ErrorResponse` |
| `@Security` | Auth requirement | `BearerAuth` |
| `@Router` | Route definition | `/users/{id} [get]` |

## View Documentation

```bash
# Start server and open
curl http://localhost:8080/docs/index.html

# JSON spec
curl http://localhost:8080/docs/doc.json

# YAML spec  
curl http://localhost:8080/docs/doc.yaml
```

## Best Practices

1. **Keep annotations updated** - แก้ไข endpoint แล้วรีบ regenerate docs
2. **Use meaningful examples** - ใช้ `@example` tag สำหรับ realistic data
3. **Document all responses** - อย่าลืม 400, 401, 404, 500
4. **Group by tags** - Tags ช่วยให้ UI อ่านง่าย
5. **Version your API** - Update `@version` เมื่อมี breaking changes

## Related

- **Fiber middleware**: See `middleware-logging.md`
- **API structure**: See `bootstrap-project.md`
