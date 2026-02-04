# db-sqlx-named

Use named parameters for complex queries.

## Why Named Parameters

- More readable than positional ($1, $2)
- Self-documenting
- Easier to maintain
- Order doesn't matter

## Basic Named Query

```go
const q = `
    INSERT INTO products (
        name, description, price, company_id, branch_id
    ) VALUES (
        :name, :description, :price, :company_id, :branch_id
    ) RETURNING *`

params := map[string]interface{}{
    "name":        payload.Name,
    "description": payload.Description,
    "price":       payload.Price,
    "company_id":  companyID,
    "branch_id":   branchID,
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
```

## Update with Named Parameters

```go
const q = `
    UPDATE products SET
        name = :name,
        price = :price,
        updated_by = :updated_by
    WHERE id = :id
      AND company_id = :company_id
    RETURNING *`

params := map[string]interface{}{
    "id":         id,
    "company_id": tenant.CompanyID,
    "name":       payload.Name,
    "price":      payload.Price,
    "updated_by": actor,
}
```

## Batch Insert

```go
const q = `
    INSERT INTO order_items (order_id, product_id, quantity, price)
    VALUES (:order_id, :product_id, :quantity, :price)`

for _, item := range items {
    params := map[string]interface{}{
        "order_id":  orderID,
        "product_id": item.ProductID,
        "quantity":  item.Quantity,
        "price":     item.Price,
    }
    _, err := db.NamedExecContext(ctx, q, params)
}
```

## Common Pitfalls

**Incorrect: Manual parameter numbering**
```go
// ❌ Hard to maintain
q := `INSERT INTO products (name, price) VALUES ($1, $2)`
db.ExecContext(ctx, q, name, price)
```

**Correct: Named parameters**
```go
// ✅ Clear what each value is
q := `INSERT INTO products (name, price) VALUES (:name, :price)`
db.NamedExecContext(ctx, q, map[string]interface{}{
    "name":  name,
    "price": price,
})
```

**Incorrect: Forgetting PrepareNamed**
```go
// ❌ Won't work with complex queries
db.NamedQueryContext(ctx, q, params)
```

**Correct: Use PrepareNamed for RETURNING**
```go
// ✅ Required for RETURNING clauses
stmt, _ := db.PrepareNamedContext(ctx, q)
defer stmt.Close()
stmt.GetContext(ctx, &rec, params)
```
