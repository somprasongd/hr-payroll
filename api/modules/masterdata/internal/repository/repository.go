package repository

import (
	"context"

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
