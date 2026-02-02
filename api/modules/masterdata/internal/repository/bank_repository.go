package repository

import (
	"context"
	"database/sql"

	"github.com/google/uuid"
)

// BankRecord represents a bank record from database
type BankRecord struct {
	ID       uuid.UUID `db:"id" json:"id"`
	Code     string    `db:"code" json:"code"`
	NameTH   string    `db:"name_th" json:"nameTh"`
	NameEN   string    `db:"name_en" json:"nameEn"`
	NameMY   string    `db:"name_my" json:"nameMy"`
	IsSystem bool      `db:"is_system" json:"isSystem"`
	IsActive bool      `db:"is_active" json:"isActive"`
	// For company-specific settings
	IsEnabled *bool `db:"is_enabled" json:"isEnabled,omitempty"`
}

// Banks returns list of available banks for a company
// - System banks that are not disabled by company settings
// - Company-specific banks
func (r Repository) Banks(ctx context.Context, companyID uuid.UUID) ([]BankRecord, error) {
	db := r.dbCtx(ctx)
	var out []BankRecord
	const q = `
SELECT 
	b.id, b.code, b.name_th, b.name_en, b.name_my, b.is_system, b.is_active,
	CASE 
		WHEN b.is_system THEN COALESCE(cbs.is_enabled, TRUE)
		ELSE TRUE
	END AS is_enabled
FROM banks b
LEFT JOIN company_bank_settings cbs ON cbs.bank_id = b.id AND cbs.company_id = $1
WHERE b.deleted_at IS NULL
	AND b.is_active = TRUE
	AND (
		(b.is_system = TRUE AND COALESCE(cbs.is_enabled, TRUE) = TRUE)
		OR 
		(b.is_system = FALSE AND b.company_id = $1)
	)
ORDER BY b.is_system DESC, b.name_th
`
	if err := db.SelectContext(ctx, &out, q, companyID); err != nil {
		return nil, err
	}
	return out, nil
}

// BanksForAdmin returns all banks for company admin (including disabled system banks)
func (r Repository) BanksForAdmin(ctx context.Context, companyID uuid.UUID) ([]BankRecord, error) {
	db := r.dbCtx(ctx)
	var out []BankRecord
	const q = `
SELECT 
	b.id, b.code, b.name_th, b.name_en, b.name_my, b.is_system, b.is_active,
	CASE 
		WHEN b.is_system THEN COALESCE(cbs.is_enabled, TRUE)
		ELSE TRUE
	END AS is_enabled
FROM banks b
LEFT JOIN company_bank_settings cbs ON cbs.bank_id = b.id AND cbs.company_id = $1
WHERE b.deleted_at IS NULL
	AND (b.is_system = TRUE OR b.company_id = $1)
ORDER BY b.is_system DESC, b.name_th
`
	if err := db.SelectContext(ctx, &out, q, companyID); err != nil {
		return nil, err
	}
	return out, nil
}

// SystemBanks returns all system banks (for superadmin)
func (r Repository) SystemBanks(ctx context.Context) ([]BankRecord, error) {
	db := r.dbCtx(ctx)
	var out []BankRecord
	const q = `SELECT id, code, name_th, name_en, name_my, is_system, is_active FROM banks WHERE is_system = TRUE AND deleted_at IS NULL ORDER BY name_th`
	if err := db.SelectContext(ctx, &out, q); err != nil {
		return nil, err
	}
	return out, nil
}

// CreateBank creates a new bank (company or system)
func (r Repository) CreateBank(ctx context.Context, code, nameTH, nameEN, nameMY string, isSystem bool, companyID *uuid.UUID, actor uuid.UUID) (*BankRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
INSERT INTO banks (code, name_th, name_en, name_my, is_system, company_id, created_by, updated_by)
VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
RETURNING id, code, name_th, name_en, name_my, is_system, is_active`
	var rec BankRecord
	if err := db.GetContext(ctx, &rec, q, code, nameTH, nameEN, nameMY, isSystem, companyID, actor); err != nil {
		return nil, err
	}
	return &rec, nil
}

// UpdateBank updates a bank
func (r Repository) UpdateBank(ctx context.Context, id uuid.UUID, code, nameTH, nameEN, nameMY string, isSystem bool, companyID *uuid.UUID, actor uuid.UUID) (*BankRecord, error) {
	db := r.dbCtx(ctx)
	var rec BankRecord
	var err error

	if isSystem {
		// System bank update (no company_id check)
		const q = `
UPDATE banks
SET code = $1, name_th = $2, name_en = $3, name_my = $4, updated_by = $5, updated_at = now()
WHERE id = $6 AND is_system = TRUE AND deleted_at IS NULL
RETURNING id, code, name_th, name_en, name_my, is_system, is_active`
		err = db.GetContext(ctx, &rec, q, code, nameTH, nameEN, nameMY, actor, id)
	} else {
		// Company bank update (with company_id check)
		const q = `
UPDATE banks
SET code = $1, name_th = $2, name_en = $3, name_my = $4, updated_by = $5, updated_at = now()
WHERE id = $6 AND company_id = $7 AND is_system = FALSE AND deleted_at IS NULL
RETURNING id, code, name_th, name_en, name_my, is_system, is_active`
		err = db.GetContext(ctx, &rec, q, code, nameTH, nameEN, nameMY, actor, id, companyID)
	}
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

// SoftDeleteBank soft deletes a bank
func (r Repository) SoftDeleteBank(ctx context.Context, id uuid.UUID, isSystem bool, companyID *uuid.UUID, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	var res sql.Result
	var err error

	if isSystem {
		res, err = db.ExecContext(ctx, `UPDATE banks SET deleted_at = now(), deleted_by = $2 WHERE id = $1 AND is_system = TRUE AND deleted_at IS NULL`, id, actor)
	} else {
		res, err = db.ExecContext(ctx, `UPDATE banks SET deleted_at = now(), deleted_by = $2 WHERE id = $1 AND company_id = $3 AND is_system = FALSE AND deleted_at IS NULL`, id, actor, companyID)
	}
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ToggleSystemBankForCompany toggles whether a system bank is enabled/disabled for a company
func (r Repository) ToggleSystemBankForCompany(ctx context.Context, bankID, companyID uuid.UUID, isEnabled bool, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	const q = `
INSERT INTO company_bank_settings (company_id, bank_id, is_enabled, updated_by, updated_at)
VALUES ($1, $2, $3, $4, now())
ON CONFLICT (company_id, bank_id) 
DO UPDATE SET is_enabled = $3, updated_by = $4, updated_at = now()`
	_, err := db.ExecContext(ctx, q, companyID, bankID, isEnabled, actor)
	return err
}
