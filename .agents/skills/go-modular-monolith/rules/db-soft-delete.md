# db-soft-delete

Soft delete pattern implementation.

## Why Soft Delete

- Recover accidentally deleted data
- Maintain referential integrity
- Audit trail of deletions
- Avoid cascading deletes

## Database Schema

```sql
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    
    -- Soft delete columns
    deleted_at TIMESTAMP,
    deleted_by UUID
);

-- Index for filtering active records
CREATE INDEX idx_products_deleted_at ON products(deleted_at) WHERE deleted_at IS NULL;
```

## Repository Implementation

### Soft Delete

```go
func (r Repository) SoftDelete(ctx context.Context, tenant contextx.TenantInfo, id, actor uuid.UUID) error {
    db := r.dbCtx(ctx)
    
    q := `
        UPDATE products 
        SET deleted_at = now(), deleted_by = $1 
        WHERE id = $2 
          AND company_id = $3 
          AND deleted_at IS NULL`
    
    args := []interface{}{actor, id, tenant.CompanyID}
    
    if tenant.HasBranchID() {
        q += " AND branch_id = $4"
        args = append(args, tenant.BranchID)
    }
    
    res, err := db.ExecContext(ctx, q, args...)
    if err != nil {
        return err
    }
    
    // Check if row was actually updated
    if rows, _ := res.RowsAffected(); rows == 0 {
        return sql.ErrNoRows
    }
    
    return nil
}
```

### Query Active Records

```go
func (r Repository) List(ctx context.Context, tenant contextx.TenantInfo) ([]Record, error) {
    db := r.dbCtx(ctx)
    
    q := `
        SELECT * FROM products 
        WHERE company_id = $1 
          AND deleted_at IS NULL  -- Filter soft deleted
        ORDER BY created_at DESC`
    
    var records []Record
    err := db.SelectContext(ctx, &records, q, tenant.CompanyID)
    return records, err
}
```

### Restore Soft Deleted

```go
func (r Repository) Restore(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID) error {
    db := r.dbCtx(ctx)
    
    q := `
        UPDATE products 
        SET deleted_at = NULL, deleted_by = NULL 
        WHERE id = $1 
          AND company_id = $2`
    
    _, err := db.ExecContext(ctx, q, id, tenant.CompanyID)
    return err
}
```

## Migration Down

```sql
-- Don't just DROP TABLE in down migration
-- First delete soft-deleted records if needed

DELETE FROM products WHERE deleted_at IS NOT NULL;

-- Then drop table
DROP TABLE IF EXISTS products;
```

## Common Pitfalls

**Incorrect: Forgetting deleted_at filter**
```go
// ❌ Returns soft-deleted records!
q := "SELECT * FROM products WHERE company_id = $1"
```

**Correct: Always filter**
```go
// ✅ Only active records
q := "SELECT * FROM products WHERE company_id = $1 AND deleted_at IS NULL"
```

**Incorrect: Hard delete**
```go
// ❌ Data permanently lost
DELETE FROM products WHERE id = $1
```

**Correct: Soft delete**
```go
// ✅ Recoverable
UPDATE products SET deleted_at = now(), deleted_by = $2 WHERE id = $1
```
