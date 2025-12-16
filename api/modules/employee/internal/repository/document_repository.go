package repository

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
)

// DocumentTypeRecord represents employee document type master data
type DocumentTypeRecord struct {
	ID        uuid.UUID  `db:"id" json:"id"`
	Code      string     `db:"code" json:"code"`
	NameTh    string     `db:"name_th" json:"nameTh"`
	NameEn    string     `db:"name_en" json:"nameEn"`
	CreatedAt time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time  `db:"updated_at" json:"updatedAt"`
	CreatedBy uuid.UUID  `db:"created_by" json:"-"`
	UpdatedBy uuid.UUID  `db:"updated_by" json:"-"`
	DeletedAt *time.Time `db:"deleted_at" json:"-"`
}

// DocumentRecord represents employee document file
type DocumentRecord struct {
	ID             uuid.UUID  `db:"id" json:"id"`
	EmployeeID     uuid.UUID  `db:"employee_id" json:"employeeId"`
	DocumentTypeID uuid.UUID  `db:"document_type_id" json:"documentTypeId"`
	FileName       string     `db:"file_name" json:"fileName"`
	ContentType    string     `db:"content_type" json:"contentType"`
	FileSizeBytes  int64      `db:"file_size_bytes" json:"fileSizeBytes"`
	Data           []byte     `db:"data" json:"-"`
	ChecksumMD5    string     `db:"checksum_md5" json:"checksumMd5"`
	DocumentNumber *string    `db:"document_number" json:"documentNumber"`
	IssueDate      *time.Time `db:"issue_date" json:"issueDate"`
	ExpiryDate     *time.Time `db:"expiry_date" json:"expiryDate"`
	Notes          *string    `db:"notes" json:"notes"`
	CreatedAt      time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt      time.Time  `db:"updated_at" json:"updatedAt"`
	CreatedBy      uuid.UUID  `db:"created_by" json:"-"`
	UpdatedBy      uuid.UUID  `db:"updated_by" json:"-"`
	DeletedAt      *time.Time `db:"deleted_at" json:"-"`

	// Joined fields
	DocumentTypeCode   string `db:"document_type_code" json:"documentTypeCode,omitempty"`
	DocumentTypeNameTh string `db:"document_type_name_th" json:"documentTypeNameTh,omitempty"`
	DocumentTypeNameEn string `db:"document_type_name_en" json:"documentTypeNameEn,omitempty"`
}

// ExpiringDocumentRecord for notifications
type ExpiringDocumentRecord struct {
	DocumentID         uuid.UUID `db:"document_id" json:"documentId"`
	EmployeeID         uuid.UUID `db:"employee_id" json:"employeeId"`
	EmployeeNumber     string    `db:"employee_number" json:"employeeNumber"`
	FirstName          string    `db:"first_name" json:"firstName"`
	LastName           string    `db:"last_name" json:"lastName"`
	DocumentTypeCode   string    `db:"document_type_code" json:"documentTypeCode"`
	DocumentTypeNameTh string    `db:"document_type_name_th" json:"documentTypeNameTh"`
	DocumentTypeNameEn string    `db:"document_type_name_en" json:"documentTypeNameEn"`
	FileName           string    `db:"file_name" json:"fileName"`
	ExpiryDate         time.Time `db:"expiry_date" json:"expiryDate"`
	DaysUntilExpiry    int       `db:"days_until_expiry" json:"daysUntilExpiry"`
}

// ===== Document Type Repository Methods =====

func (r Repository) ListDocumentTypes(ctx context.Context) ([]DocumentTypeRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
SELECT id, code, name_th, name_en, created_at, updated_at
FROM employee_document_type
WHERE deleted_at IS NULL
ORDER BY code`
	var out []DocumentTypeRecord
	if err := db.SelectContext(ctx, &out, q); err != nil {
		return nil, err
	}
	if out == nil {
		out = make([]DocumentTypeRecord, 0)
	}
	return out, nil
}

func (r Repository) GetDocumentType(ctx context.Context, id uuid.UUID) (*DocumentTypeRecord, error) {
	db := r.dbCtx(ctx)
	const q = `SELECT id, code, name_th, name_en, created_at, updated_at FROM employee_document_type WHERE id=$1 AND deleted_at IS NULL`
	var rec DocumentTypeRecord
	if err := db.GetContext(ctx, &rec, q, id); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) GetDocumentTypeByCode(ctx context.Context, code string) (*DocumentTypeRecord, error) {
	db := r.dbCtx(ctx)
	const q = `SELECT id, code, name_th, name_en, created_at, updated_at FROM employee_document_type WHERE LOWER(code) = LOWER($1) AND deleted_at IS NULL`
	var rec DocumentTypeRecord
	if err := db.GetContext(ctx, &rec, q, code); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) CreateDocumentType(ctx context.Context, input DocumentTypeRecord, actor uuid.UUID) (*DocumentTypeRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
INSERT INTO employee_document_type (code, name_th, name_en, created_by, updated_by)
VALUES ($1, $2, $3, $4, $4)
RETURNING id, code, name_th, name_en, created_at, updated_at`
	var rec DocumentTypeRecord
	if err := db.GetContext(ctx, &rec, q, input.Code, input.NameTh, input.NameEn, actor); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) UpdateDocumentType(ctx context.Context, id uuid.UUID, input DocumentTypeRecord, actor uuid.UUID) (*DocumentTypeRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
UPDATE employee_document_type SET code=$1, name_th=$2, name_en=$3, updated_by=$4
WHERE id=$5 AND deleted_at IS NULL
RETURNING id, code, name_th, name_en, created_at, updated_at`
	var rec DocumentTypeRecord
	if err := db.GetContext(ctx, &rec, q, input.Code, input.NameTh, input.NameEn, actor, id); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) SoftDeleteDocumentType(ctx context.Context, id uuid.UUID, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	const q = `UPDATE employee_document_type SET deleted_at = now(), deleted_by = $1 WHERE id = $2 AND deleted_at IS NULL`
	res, err := db.ExecContext(ctx, q, actor, id)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ===== Employee Document Repository Methods =====

func (r Repository) ListDocuments(ctx context.Context, employeeID uuid.UUID) ([]DocumentRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
SELECT 
  ed.id, ed.employee_id, ed.document_type_id, ed.file_name, ed.content_type, ed.file_size_bytes, ed.checksum_md5,
  ed.document_number, ed.issue_date, ed.expiry_date, ed.notes, ed.created_at, ed.updated_at,
  edt.code AS document_type_code, edt.name_th AS document_type_name_th, edt.name_en AS document_type_name_en
FROM employee_document ed
JOIN employee_document_type edt ON edt.id = ed.document_type_id
WHERE ed.employee_id = $1 AND ed.deleted_at IS NULL
ORDER BY ed.created_at DESC`
	var out []DocumentRecord
	if err := db.SelectContext(ctx, &out, q, employeeID); err != nil {
		return nil, err
	}
	if out == nil {
		out = make([]DocumentRecord, 0)
	}
	return out, nil
}

func (r Repository) GetDocument(ctx context.Context, id uuid.UUID) (*DocumentRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
SELECT 
  ed.id, ed.employee_id, ed.document_type_id, ed.file_name, ed.content_type, ed.file_size_bytes, ed.checksum_md5,
  ed.document_number, ed.issue_date, ed.expiry_date, ed.notes, ed.created_at, ed.updated_at,
  edt.code AS document_type_code, edt.name_th AS document_type_name_th, edt.name_en AS document_type_name_en
FROM employee_document ed
JOIN employee_document_type edt ON edt.id = ed.document_type_id
WHERE ed.id = $1 AND ed.deleted_at IS NULL`
	var rec DocumentRecord
	if err := db.GetContext(ctx, &rec, q, id); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) GetDocumentWithData(ctx context.Context, id uuid.UUID) (*DocumentRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
SELECT id, employee_id, document_type_id, file_name, content_type, file_size_bytes, data, checksum_md5,
       document_number, issue_date, expiry_date, notes, created_at, updated_at
FROM employee_document
WHERE id = $1 AND deleted_at IS NULL`
	var rec DocumentRecord
	if err := db.GetContext(ctx, &rec, q, id); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) InsertDocument(ctx context.Context, input DocumentRecord, actor uuid.UUID) (*DocumentRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
INSERT INTO employee_document (
  employee_id, document_type_id, file_name, content_type, file_size_bytes, data, checksum_md5,
  document_number, issue_date, expiry_date, notes, created_by, updated_by
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
RETURNING id, employee_id, document_type_id, file_name, content_type, file_size_bytes, checksum_md5,
          document_number, issue_date, expiry_date, notes, created_at, updated_at`
	var rec DocumentRecord
	if err := db.GetContext(ctx, &rec, q,
		input.EmployeeID,
		input.DocumentTypeID,
		input.FileName,
		input.ContentType,
		input.FileSizeBytes,
		input.Data,
		input.ChecksumMD5,
		input.DocumentNumber,
		input.IssueDate,
		input.ExpiryDate,
		input.Notes,
		actor,
	); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) UpdateDocument(ctx context.Context, id uuid.UUID, input DocumentRecord, actor uuid.UUID) (*DocumentRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
UPDATE employee_document SET
  document_type_id=$1, document_number=$2, issue_date=$3, expiry_date=$4, notes=$5, updated_by=$6
WHERE id=$7 AND deleted_at IS NULL
RETURNING id, employee_id, document_type_id, file_name, content_type, file_size_bytes, checksum_md5,
          document_number, issue_date, expiry_date, notes, created_at, updated_at`
	var rec DocumentRecord
	if err := db.GetContext(ctx, &rec, q,
		input.DocumentTypeID,
		input.DocumentNumber,
		input.IssueDate,
		input.ExpiryDate,
		input.Notes,
		actor,
		id,
	); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) SoftDeleteDocument(ctx context.Context, id uuid.UUID, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	const q = `UPDATE employee_document SET deleted_at = now(), deleted_by = $1 WHERE id = $2 AND deleted_at IS NULL`
	res, err := db.ExecContext(ctx, q, actor, id)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ===== Expiring Documents =====

func (r Repository) ListExpiringDocuments(ctx context.Context, daysAhead int) ([]ExpiringDocumentRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
SELECT 
  document_id, employee_id, employee_number, first_name, last_name,
  document_type_code, document_type_name_th, document_type_name_en,
  file_name, expiry_date, days_until_expiry
FROM v_employee_documents_expiring
WHERE days_until_expiry <= $1
ORDER BY days_until_expiry ASC, employee_number ASC`
	var out []ExpiringDocumentRecord
	if err := db.SelectContext(ctx, &out, q, daysAhead); err != nil {
		return nil, err
	}
	if out == nil {
		out = make([]ExpiringDocumentRecord, 0)
	}
	return out, nil
}
