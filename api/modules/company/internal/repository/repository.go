package repository

import (
	"context"
	"time"

	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Repository struct {
	dbCtx transactor.DBTXContext
}

func NewRepository(dbCtx transactor.DBTXContext) Repository {
	return Repository{dbCtx: dbCtx}
}

// Company represents a company record
type Company struct {
	ID        uuid.UUID `db:"id" json:"id"`
	Code      string    `db:"code" json:"code"`
	Name      string    `db:"name" json:"name"`
	Status    string    `db:"status" json:"status"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

// GetCurrent returns the current company based on tenant context
func (r Repository) GetCurrent(ctx context.Context) (*Company, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, nil
	}

	db := r.dbCtx(ctx)
	var out Company
	const q = `SELECT id, code, name, status, created_at, updated_at FROM companies WHERE id = $1`
	if err := db.GetContext(ctx, &out, q, tenant.CompanyID); err != nil {
		return nil, err
	}
	return &out, nil
}

// Update updates the current company
func (r Repository) Update(ctx context.Context, code, name string, actor uuid.UUID) (*Company, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, nil
	}

	db := r.dbCtx(ctx)
	const q = `
		UPDATE companies
		SET code = $1, name = $2, updated_by = $3, updated_at = now()
		WHERE id = $4
		RETURNING id, code, name, status, created_at, updated_at`
	var out Company
	if err := db.GetContext(ctx, &out, q, code, name, actor, tenant.CompanyID); err != nil {
		return nil, err
	}
	return &out, nil
}
