package repository

import (
	"context"
	"time"

	"github.com/google/uuid"

	"hrms/shared/common/storage/sqldb/transactor"
)

type Repository struct {
	dbCtx transactor.DBTXContext
}

func NewRepository(dbCtx transactor.DBTXContext) Repository {
	return Repository{dbCtx: dbCtx}
}

type Record struct {
	ID              uuid.UUID  `db:"id"`
	VersionNo       int64      `db:"version_no"`
	StartDate       time.Time  `db:"start_date"`
	EndDate         *time.Time `db:"end_date"`
	Status          string     `db:"status"`
	CompanyName     string     `db:"company_name"`
	AddressLine1    *string    `db:"address_line1"`
	AddressLine2    *string    `db:"address_line2"`
	Subdistrict     *string    `db:"subdistrict"`
	District        *string    `db:"district"`
	Province        *string    `db:"province"`
	PostalCode      *string    `db:"postal_code"`
	PhoneMain       *string    `db:"phone_main"`
	PhoneAlt        *string    `db:"phone_alt"`
	Email           *string    `db:"email"`
	TaxID           *string    `db:"tax_id"`
	SlipFooterNote  *string    `db:"slip_footer_note"`
	LogoID          *uuid.UUID `db:"logo_id"`
	CreatedAt       time.Time  `db:"created_at"`
	UpdatedAt       time.Time  `db:"updated_at"`
	UpdatedBy       uuid.UUID  `db:"updated_by"`
	CreatedBy       uuid.UUID  `db:"created_by"`
	EffectiveActive bool       `db:"effective_active"`
}

type LogoRecord struct {
	ID            uuid.UUID `db:"id"`
	FileName      string    `db:"file_name"`
	ContentType   string    `db:"content_type"`
	FileSizeBytes int64     `db:"file_size_bytes"`
	Data          []byte    `db:"data"`
	ChecksumMD5   string    `db:"checksum_md5"`
	CreatedAt     time.Time `db:"created_at"`
	CreatedBy     uuid.UUID `db:"created_by"`
}

type ListResult struct {
	Rows  []Record
	Total int
}

func (r Repository) List(ctx context.Context, page, limit int) (ListResult, error) {
	db := r.dbCtx(ctx)
	offset := (page - 1) * limit
	if offset < 0 {
		offset = 0
	}

	const baseQuery = `
SELECT
  id,
  COALESCE(version_no, 0) AS version_no,
  lower(effective_daterange) AS start_date,
  NULLIF(upper(effective_daterange), 'infinity') AS end_date,
  status,
  company_name,
  address_line1,
  address_line2,
  subdistrict,
  district,
  province,
  postal_code,
  phone_main,
  phone_alt,
  email,
  tax_id,
  slip_footer_note,
  logo_id,
  created_at,
  updated_at,
  created_by,
  updated_by,
  status = 'active' AS effective_active
FROM payroll_org_profile
ORDER BY version_no DESC
LIMIT $1 OFFSET $2`

	rows, err := db.QueryxContext(ctx, baseQuery, limit, offset)
	if err != nil {
		return ListResult{}, err
	}
	defer rows.Close()

	var items []Record
	for rows.Next() {
		var rec Record
		if err := rows.StructScan(&rec); err != nil {
			return ListResult{}, err
		}
		items = append(items, rec)
	}

	const countQ = `SELECT COUNT(1) FROM payroll_org_profile`
	var total int
	if err := db.GetContext(ctx, &total, countQ); err != nil {
		return ListResult{}, err
	}

	return ListResult{Rows: items, Total: total}, nil
}

func (r Repository) Get(ctx context.Context, id uuid.UUID) (*Record, error) {
	db := r.dbCtx(ctx)
	const q = `
SELECT
  id,
  COALESCE(version_no, 0) AS version_no,
  lower(effective_daterange) AS start_date,
  NULLIF(upper(effective_daterange), 'infinity') AS end_date,
  status,
  company_name,
  address_line1,
  address_line2,
  subdistrict,
  district,
  province,
  postal_code,
  phone_main,
  phone_alt,
  email,
  tax_id,
  slip_footer_note,
  logo_id,
  created_at,
  updated_at,
  created_by,
  updated_by,
  status = 'active' AS effective_active
FROM payroll_org_profile
WHERE id = $1
LIMIT 1`
	var rec Record
	if err := db.GetContext(ctx, &rec, q, id); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) GetEffective(ctx context.Context, date time.Time) (*Record, error) {
	db := r.dbCtx(ctx)
	const q = `
SELECT
  id,
  COALESCE(version_no, 0) AS version_no,
  lower(effective_daterange) AS start_date,
  NULLIF(upper(effective_daterange), 'infinity') AS end_date,
  status,
  company_name,
  address_line1,
  address_line2,
  subdistrict,
  district,
  province,
  postal_code,
  phone_main,
  phone_alt,
  email,
  tax_id,
  slip_footer_note,
  logo_id,
  created_at,
  updated_at,
  created_by,
  updated_by,
  status = 'active' AS effective_active
FROM get_effective_org_profile($1)
WHERE id IS NOT NULL
LIMIT 1`
	var rec Record
	if err := db.GetContext(ctx, &rec, q, date); err != nil {
		return nil, err
	}
	return &rec, nil
}

type UpsertPayload struct {
	StartDate      *time.Time
	CompanyName    *string
	AddressLine1   *string
	AddressLine2   *string
	Subdistrict    *string
	District       *string
	Province       *string
	PostalCode     *string
	PhoneMain      *string
	PhoneAlt       *string
	Email          *string
	TaxID          *string
	SlipFooterNote *string
	LogoID         *uuid.UUID
	Status         *string
}

func (r Repository) Create(ctx context.Context, payload UpsertPayload, actor uuid.UUID) (*Record, error) {
	db := r.dbCtx(ctx)
	const q = `
INSERT INTO payroll_org_profile (
  effective_daterange,
  company_name,
  address_line1,
  address_line2,
  subdistrict,
  district,
  province,
  postal_code,
  phone_main,
  phone_alt,
  email,
  tax_id,
  slip_footer_note,
  logo_id,
  status,
  created_by,
  updated_by
) VALUES (
  daterange($1::date, NULL, '[)'),
  $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,COALESCE($15::config_status, 'active'::config_status),$16,$16
)
RETURNING
  id,
  COALESCE(version_no, 0) AS version_no,
  lower(effective_daterange) AS start_date,
  NULLIF(upper(effective_daterange), 'infinity') AS end_date,
  status,
  company_name,
  address_line1,
  address_line2,
  subdistrict,
  district,
  province,
  postal_code,
  phone_main,
  phone_alt,
  email,
  tax_id,
  slip_footer_note,
  logo_id,
  created_at,
  updated_at,
  created_by,
  updated_by,
  status = 'active' AS effective_active`

	var rec Record
	if err := db.GetContext(ctx, &rec, q,
		payload.StartDate,
		payload.CompanyName,
		payload.AddressLine1,
		payload.AddressLine2,
		payload.Subdistrict,
		payload.District,
		payload.Province,
		payload.PostalCode,
		payload.PhoneMain,
		payload.PhoneAlt,
		payload.Email,
		payload.TaxID,
		payload.SlipFooterNote,
		payload.LogoID,
		payload.Status,
		actor,
	); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) Update(ctx context.Context, id uuid.UUID, payload UpsertPayload, actor uuid.UUID) (*Record, error) {
	db := r.dbCtx(ctx)
	const q = `
UPDATE payroll_org_profile
SET
  effective_daterange = daterange(COALESCE($1::date, lower(effective_daterange)), NULL, '[)'),
  company_name = COALESCE($2, company_name),
  address_line1 = $3,
  address_line2 = $4,
  subdistrict = $5,
  district = $6,
  province = $7,
  postal_code = $8,
  phone_main = $9,
  phone_alt = $10,
  email = $11,
  tax_id = $12,
  slip_footer_note = $13,
  logo_id = $14,
  status = COALESCE($15::config_status, status),
  updated_by = $16,
  updated_at = now()
WHERE id = $17
RETURNING
  id,
  COALESCE(version_no, 0) AS version_no,
  lower(effective_daterange) AS start_date,
  NULLIF(upper(effective_daterange), 'infinity') AS end_date,
  status,
  company_name,
  address_line1,
  address_line2,
  subdistrict,
  district,
  province,
  postal_code,
  phone_main,
  phone_alt,
  email,
  tax_id,
  slip_footer_note,
  logo_id,
  created_at,
  updated_at,
  created_by,
  updated_by,
  status = 'active' AS effective_active`

	var rec Record
	if err := db.GetContext(ctx, &rec, q,
		payload.StartDate,
		payload.CompanyName,
		payload.AddressLine1,
		payload.AddressLine2,
		payload.Subdistrict,
		payload.District,
		payload.Province,
		payload.PostalCode,
		payload.PhoneMain,
		payload.PhoneAlt,
		payload.Email,
		payload.TaxID,
		payload.SlipFooterNote,
		payload.LogoID,
		payload.Status,
		actor,
		id,
	); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) InsertLogo(ctx context.Context, input LogoRecord) (*LogoRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
INSERT INTO payroll_org_logo (file_name, content_type, file_size_bytes, data, checksum_md5, created_by)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, file_name, content_type, file_size_bytes, checksum_md5, created_at, created_by`

	var rec LogoRecord
	if err := db.GetContext(ctx, &rec, q,
		input.FileName,
		input.ContentType,
		input.FileSizeBytes,
		input.Data,
		input.ChecksumMD5,
		input.CreatedBy,
	); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) GetLogo(ctx context.Context, id uuid.UUID) (*LogoRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
SELECT id, file_name, content_type, file_size_bytes, data, checksum_md5, created_at, created_by
FROM payroll_org_logo
WHERE id = $1
LIMIT 1`
	var rec LogoRecord
	if err := db.GetContext(ctx, &rec, q, id); err != nil {
		return nil, err
	}
	return &rec, nil
}
