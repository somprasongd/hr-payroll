# module-repository

Repository pattern with tenant-aware queries.

## Why Repository Pattern

- Abstracts data access logic
- Centralizes query building
- Enforces tenant isolation
- Enables testing with mocks

## File: internal/repository/repository.go

```go
package repository

import (
    "context"
    "database/sql"
    "fmt"
    "strings"
    "time"
    "github.com/google/uuid"
    "{project}/api/shared/common/contextx"
    "{project}/api/shared/common/storage/sqldb/transactor"
)

type Repository struct {
    dbCtx transactor.DBTXContext
}

func NewRepository(dbCtx transactor.DBTXContext) Repository {
    return Repository{dbCtx: dbCtx}
}

// ListRecord for list view (subset of fields)
type ListRecord struct {
    ID        uuid.UUID `db:"id"`
    Name      string    `db:"name"`
    CreatedAt time.Time `db:"created_at"`
}

// Record for full entity (all fields)
type Record struct {
    ID        uuid.UUID  `db:"id"`
    Name      string     `db:"name"`
    CompanyID uuid.UUID  `db:"company_id"`
    BranchID  uuid.UUID  `db:"branch_id"`
    CreatedAt time.Time  `db:"created_at"`
    UpdatedAt time.Time  `db:"updated_at"`
    CreatedBy uuid.UUID  `db:"created_by"`
    UpdatedBy uuid.UUID  `db:"updated_by"`
    DeletedAt *time.Time `db:"deleted_at"`
    DeletedBy *uuid.UUID `db:"deleted_by"`
}

type ListResult struct {
    Rows  []ListRecord
    Total int
}

// List with pagination and filtering
func (r Repository) List(ctx context.Context, tenant contextx.TenantInfo, page, limit int, search string) (ListResult, error) {
    db := r.dbCtx(ctx)
    offset := (page - 1) * limit
    
    // Build WHERE clause dynamically
    var where []string
    var args []interface{}
    
    // Always filter by tenant
    where = append(where, "deleted_at IS NULL")
    args = append(args, tenant.CompanyID)
    where = append(where, fmt.Sprintf("company_id = $%d", len(args)))
    
    // Optional branch filter
    if tenant.HasBranchID() {
        args = append(args, tenant.BranchID)
        where = append(where, fmt.Sprintf("branch_id = $%d", len(args)))
    }
    
    // Optional search filter
    if s := strings.TrimSpace(search); s != "" {
        val := "%" + strings.ToLower(s) + "%"
        args = append(args, val)
        where = append(where, fmt.Sprintf("LOWER(name) LIKE $%d", len(args)))
    }
    
    whereClause := strings.Join(where, " AND ")
    args = append(args, limit, offset)
    
    // Build query with numbered parameters
    query := fmt.Sprintf(`
        SELECT id, name, created_at
        FROM {resources}
        WHERE %s
        ORDER BY created_at DESC
        LIMIT $%d OFFSET $%d
    `, whereClause, len(args)-1, len(args))
    
    rows, err := db.QueryxContext(ctx, query, args...)
    if err != nil {
        return ListResult{}, err
    }
    defer rows.Close()
    
    var list []ListRecord
    for rows.Next() {
        var rec ListRecord
        if err := rows.StructScan(&rec); err != nil {
            return ListResult{}, err
        }
        list = append(list, rec)
    }
    
    // Count total
    countArgs := args[:len(args)-2]
    countQuery := fmt.Sprintf("SELECT COUNT(1) FROM {resources} WHERE %s", whereClause)
    var total int
    if err := db.GetContext(ctx, &total, countQuery, countArgs...); err != nil {
        return ListResult{}, err
    }
    
    if list == nil {
        list = make([]ListRecord, 0)
    }
    
    return ListResult{Rows: list, Total: total}, nil
}

// Get single record by ID
func (r Repository) Get(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID) (*Record, error) {
    db := r.dbCtx(ctx)
    q := `
        SELECT *
        FROM {resources}
        WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
        LIMIT 1`
    args := []interface{}{id, tenant.CompanyID}
    
    if tenant.HasBranchID() {
        q = strings.Replace(q, "company_id = $2", "company_id = $2 AND branch_id = $3", 1)
        args = append(args, tenant.BranchID)
    }
    
    var rec Record
    if err := db.GetContext(ctx, &rec, q, args...); err != nil {
        return nil, err
    }
    return &rec, nil
}

// Create with named parameters
func (r Repository) Create(ctx context.Context, payload Record, companyID, branchID, actor uuid.UUID) (*Record, error) {
    db := r.dbCtx(ctx)
    const q = `
        INSERT INTO {resources} (name, company_id, branch_id, created_by, updated_by)
        VALUES (:name, :company_id, :branch_id, :created_by, :updated_by)
        RETURNING *`
    
    payload.CreatedAt = time.Now()
    payload.UpdatedAt = payload.CreatedAt
    
    params := map[string]interface{}{
        "name":       payload.Name,
        "company_id": companyID,
        "branch_id":  branchID,
        "created_by": actor,
        "updated_by": actor,
    }
    
    stmt, err := db.PrepareNamedContext(ctx, q)
    if err != nil {
        return nil, err
    }
    defer stmt.Close()
    
    var rec Record
    if err := stmt.GetContext(ctx, &rec, params); err != nil {
        return nil, err
    }
    return &rec, nil
}

// SoftDelete sets deleted_at timestamp
func (r Repository) SoftDelete(ctx context.Context, tenant contextx.TenantInfo, id, actor uuid.UUID) error {
    db := r.dbCtx(ctx)
    q := `UPDATE {resources} SET deleted_at = now(), deleted_by = $1 WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL`
    args := []interface{}{actor, id, tenant.CompanyID}
    
    if tenant.HasBranchID() {
        q += " AND branch_id = $4"
        args = append(args, tenant.BranchID)
    }
    
    res, err := db.ExecContext(ctx, q, args...)
    if err != nil {
        return err
    }
    if rows, _ := res.RowsAffected(); rows == 0 {
        return sql.ErrNoRows
    }
    return nil
}
```

## Repository Patterns

### 1. Tenant Isolation
Always filter by `company_id` and optionally `branch_id`.

### 2. Soft Delete
Use `deleted_at IS NULL` in all queries.

### 3. Named Parameters
Use `sqlx.NamedQuery` for complex inserts/updates.

### 4. Dynamic Query Building
Build WHERE clauses dynamically with proper parameter numbering.

## Common Pitfalls

**Incorrect: Hardcoded tenant filter**
```go
// ❌ Won't work with RLS
q := "SELECT * FROM products WHERE company_id = $1"
```

**Correct: Conditional tenant filter**
```go
// ✅ Handles both company-only and company+branch
code if tenant.HasBranchID() {
    q += " AND branch_id = $3"
}
```
