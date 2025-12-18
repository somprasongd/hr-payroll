package repository

import (
	"context"
	"database/sql"

	"github.com/google/uuid"

	"hrms/shared/common/storage/sqldb/transactor"
)

type Repository struct {
	dbCtx transactor.DBTXContext
}

func NewRepository(dbCtx transactor.DBTXContext) Repository {
	return Repository{dbCtx: dbCtx}
}

type MasterRecord struct {
	ID   uuid.UUID `db:"id" json:"id"`
	Code string    `db:"code" json:"code"`
	Name string    `db:"name_th" json:"name"`
}

func (r Repository) PersonTitles(ctx context.Context) ([]MasterRecord, error) {
	db := r.dbCtx(ctx)
	var out []MasterRecord
	if err := db.SelectContext(ctx, &out, `SELECT id, code, name_th FROM person_title ORDER BY name_th`); err != nil {
		return nil, err
	}
	return out, nil
}

func (r Repository) EmployeeTypes(ctx context.Context) ([]MasterRecord, error) {
	db := r.dbCtx(ctx)
	var out []MasterRecord
	if err := db.SelectContext(ctx, &out, `SELECT id, code, name_th FROM employee_type ORDER BY name_th`); err != nil {
		return nil, err
	}
	return out, nil
}

func (r Repository) IDDocumentTypes(ctx context.Context) ([]MasterRecord, error) {
	db := r.dbCtx(ctx)
	var out []MasterRecord
	if err := db.SelectContext(ctx, &out, `SELECT id, code, name_th FROM id_document_type ORDER BY name_th`); err != nil {
		return nil, err
	}
	return out, nil
}

func (r Repository) Departments(ctx context.Context, companyID uuid.UUID) ([]MasterRecord, error) {
	db := r.dbCtx(ctx)
	var out []MasterRecord
	if companyID == uuid.Nil {
		// Fallback for backward compatibility - return all
		if err := db.SelectContext(ctx, &out, `SELECT id, code, name_th FROM department WHERE deleted_at IS NULL ORDER BY name_th`); err != nil {
			return nil, err
		}
	} else {
		if err := db.SelectContext(ctx, &out, `SELECT id, code, name_th FROM department WHERE deleted_at IS NULL AND company_id = $1 ORDER BY name_th`, companyID); err != nil {
			return nil, err
		}
	}
	return out, nil
}

func (r Repository) EmployeePositions(ctx context.Context, companyID uuid.UUID) ([]MasterRecord, error) {
	db := r.dbCtx(ctx)
	var out []MasterRecord
	if companyID == uuid.Nil {
		// Fallback for backward compatibility - return all
		if err := db.SelectContext(ctx, &out, `SELECT id, code, name_th FROM employee_position WHERE deleted_at IS NULL ORDER BY name_th`); err != nil {
			return nil, err
		}
	} else {
		if err := db.SelectContext(ctx, &out, `SELECT id, code, name_th FROM employee_position WHERE deleted_at IS NULL AND company_id = $1 ORDER BY name_th`, companyID); err != nil {
			return nil, err
		}
	}
	return out, nil
}

func (r Repository) CreateDepartment(ctx context.Context, code, name string, companyID, actor uuid.UUID) (*MasterRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
INSERT INTO department (code, name_th, company_id, created_by, updated_by)
VALUES ($1, $2, $3, $4, $4)
RETURNING id, code, name_th`
	var rec MasterRecord
	if err := db.GetContext(ctx, &rec, q, code, name, companyID, actor); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) UpdateDepartment(ctx context.Context, id uuid.UUID, code, name string, companyID, actor uuid.UUID) (*MasterRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
UPDATE department
SET code = $1,
    name_th = $2,
    updated_by = $3,
    updated_at = now(),
    deleted_at = NULL,
    deleted_by = NULL
WHERE id = $4 AND company_id = $5 AND deleted_at IS NULL
RETURNING id, code, name_th`
	var rec MasterRecord
	if err := db.GetContext(ctx, &rec, q, code, name, actor, id, companyID); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) SoftDeleteDepartment(ctx context.Context, id uuid.UUID, companyID, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	res, err := db.ExecContext(ctx, `UPDATE department SET deleted_at = now(), deleted_by = $2 WHERE id = $1 AND company_id = $3 AND deleted_at IS NULL`, id, actor, companyID)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r Repository) CreateEmployeePosition(ctx context.Context, code, name string, companyID, actor uuid.UUID) (*MasterRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
INSERT INTO employee_position (code, name_th, company_id, created_by, updated_by)
VALUES ($1, $2, $3, $4, $4)
RETURNING id, code, name_th`
	var rec MasterRecord
	if err := db.GetContext(ctx, &rec, q, code, name, companyID, actor); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) UpdateEmployeePosition(ctx context.Context, id uuid.UUID, code, name string, companyID, actor uuid.UUID) (*MasterRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
UPDATE employee_position
SET code = $1,
    name_th = $2,
    updated_by = $3,
    updated_at = now(),
    deleted_at = NULL,
    deleted_by = NULL
WHERE id = $4 AND company_id = $5 AND deleted_at IS NULL
RETURNING id, code, name_th`
	var rec MasterRecord
	if err := db.GetContext(ctx, &rec, q, code, name, actor, id, companyID); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) SoftDeleteEmployeePosition(ctx context.Context, id uuid.UUID, companyID, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	res, err := db.ExecContext(ctx, `UPDATE employee_position SET deleted_at = now(), deleted_by = $2 WHERE id = $1 AND company_id = $3 AND deleted_at IS NULL`, id, actor, companyID)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}
