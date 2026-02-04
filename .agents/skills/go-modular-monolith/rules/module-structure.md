# module-structure

Internal package layout for domain modules.

## Why This Structure

The `internal/` package ensures:
- Encapsulation (not importable from outside module)
- Clear separation of concerns
- CQRS pattern enforcement

## Module Structure

```
api/modules/{module}/
├── module.go                    # Module definition, route registration
├── go.mod                       # Separate Go module
└── internal/
    ├── dto/
    │   └── dto.go              # Data transfer objects
    ├── entity/
    │   └── entity.go           # Domain entities (optional)
    ├── feature/
    │   ├── create/
    │   │   ├── command.go      # Write operation handler
    │   │   └── endpoint.go     # HTTP handler + Swagger docs
    │   ├── list/
    │   │   ├── query.go        # Read operation handler
    │   │   └── endpoint.go
    │   ├── get/
    │   │   ├── query.go
    │   │   └── endpoint.go
    │   ├── update/
    │   │   ├── command.go
    │   │   └── endpoint.go
    │   └── delete/
    │       ├── command.go
    │       └── endpoint.go
    ├── repository/
    │   └── repository.go       # Data access layer
    └── subscriber/             # Event handlers (optional)
        └── order_subscriber.go # Handle events from other modules
```

## Key Principles

### 1. CQRS Separation
- Commands (write): `feature/{action}/command.go`
- Queries (read): `feature/{action}/query.go`

### 2. Feature-Based Organization
Each feature is self-contained with its handler and endpoint.

### 3. DTO Pattern
Separate DTOs for different views:
- `ListItem` - For list responses
- `Detail` - For single item responses

## Common Pitfalls

**Incorrect: Mixing all features in one file**
```
module/
├── handlers.go        # ❌ All handlers mixed
├── service.go         # ❌ All business logic mixed
└── repository.go      # ❌ All queries mixed
```

**Correct: Feature-based separation**
```
module/
└── internal/
    └── feature/
        ├── create/    # ✅ Self-contained
        ├── list/      # ✅ Self-contained
        └── get/       # ✅ Self-contained
```
