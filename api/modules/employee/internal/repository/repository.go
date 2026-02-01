package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"

	"hrms/shared/common/contextx"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Repository struct {
	dbCtx transactor.DBTXContext
}

func NewRepository(dbCtx transactor.DBTXContext) Repository {
	return Repository{dbCtx: dbCtx}
}

type ListRecord struct {
	ID                  uuid.UUID  `db:"id"`
	EmployeeNumber      string     `db:"employee_number"`
	FullNameTh          string     `db:"full_name_th"`
	TitleName           *string    `db:"title_name"`
	EmployeeTypeName    string     `db:"employee_type_name"`
	Phone               *string    `db:"phone"`
	Email               *string    `db:"email"`
	PhotoID             *uuid.UUID `db:"photo_id"`
	EmploymentStartDate time.Time  `db:"employment_start_date"`
	Status              string     `db:"status"`
}

type DetailRecord struct {
	ID                          uuid.UUID  `db:"id"`
	EmployeeNumber              string     `db:"employee_number"`
	CompanyID                   uuid.UUID  `db:"company_id"`
	BranchID                    uuid.UUID  `db:"branch_id"`
	TitleID                     uuid.UUID  `db:"title_id"`
	TitleName                   *string    `db:"title_name"`
	FirstName                   string     `db:"first_name"`
	LastName                    string     `db:"last_name"`
	Nickname                    *string    `db:"nickname"`
	IDDocumentTypeID            uuid.UUID  `db:"id_document_type_id"`
	IDDocumentNumber            string     `db:"id_document_number"`
	IDDocumentOtherDescription  *string    `db:"id_document_other_description"`
	Phone                       *string    `db:"phone"`
	Email                       *string    `db:"email"`
	PhotoID                     *uuid.UUID `db:"photo_id"`
	EmployeeTypeID              uuid.UUID  `db:"employee_type_id"`
	DepartmentID                *uuid.UUID `db:"department_id"`
	PositionID                  *uuid.UUID `db:"position_id"`
	BasePayAmount               float64    `db:"base_pay_amount"`
	EmploymentStartDate         time.Time  `db:"employment_start_date"`
	EmploymentEndDate           *time.Time `db:"employment_end_date"`
	BankName                    *string    `db:"bank_name"`
	BankAccountNo               *string    `db:"bank_account_no"`
	SSOContribute               bool       `db:"sso_contribute"`
	SSODeclaredWage             *float64   `db:"sso_declared_wage"`
	SSOHospitalName             *string    `db:"sso_hospital_name"`
	ProvidentFundContribute     bool       `db:"provident_fund_contribute"`
	ProvidentFundRateEmployee   float64    `db:"provident_fund_rate_employee"`
	ProvidentFundRateEmployer   float64    `db:"provident_fund_rate_employer"`
	WithholdTax                 bool       `db:"withhold_tax"`
	AllowHousing                bool       `db:"allow_housing"`
	AllowWater                  bool       `db:"allow_water"`
	AllowElectric               bool       `db:"allow_electric"`
	AllowInternet               bool       `db:"allow_internet"`
	AllowDoctorFee              bool       `db:"allow_doctor_fee"`
	AllowAttendanceBonusNoLate  bool       `db:"allow_attendance_bonus_nolate"`
	AllowAttendanceBonusNoLeave bool       `db:"allow_attendance_bonus_noleave"`
	CreatedAt                   time.Time  `db:"created_at"`
	UpdatedAt                   time.Time  `db:"updated_at"`
	Status                      string     `db:"status"`
	CreatedBy                   uuid.UUID  `db:"created_by"`
	UpdatedBy                   uuid.UUID  `db:"updated_by"`
	DeletedAt                   *time.Time `db:"deleted_at"`
	DeletedBy                   *uuid.UUID `db:"deleted_by"`
}

type ListResult struct {
	Rows  []ListRecord
	Total int
}

type PhotoRecord struct {
	ID            uuid.UUID `db:"id"`
	CompanyID     uuid.UUID `db:"company_id"`
	FileName      string    `db:"file_name"`
	ContentType   string    `db:"content_type"`
	FileSizeBytes int64     `db:"file_size_bytes"`
	Data          []byte    `db:"data"`
	ChecksumMD5   string    `db:"checksum_md5"`
	CreatedAt     time.Time `db:"created_at"`
	CreatedBy     uuid.UUID `db:"created_by"`
}

type AccumRecord struct {
	ID        uuid.UUID `db:"id" json:"id"`
	AccumType string    `db:"accum_type" json:"accumType"`
	AccumYear *int      `db:"accum_year" json:"accumYear"`
	Amount    float64   `db:"amount" json:"amount"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
	UpdatedBy uuid.UUID `db:"updated_by" json:"updatedBy"`
}

func (r Repository) List(ctx context.Context, tenant contextx.TenantInfo, page, limit int, search, status, employeeTypeID string, hasOutstandingDebt bool) (ListResult, error) {
	db := r.dbCtx(ctx)
	offset := (page - 1) * limit
	if offset < 0 {
		offset = 0
	}

	var (
		where []string
		args  []interface{}
	)
	where = append(where, "e.deleted_at IS NULL")

	// Filter by Company
	args = append(args, tenant.CompanyID)
	where = append(where, fmt.Sprintf("e.company_id = $%d", len(args)))

	// Filter by Branch (single branch from dropdown)
	if tenant.HasBranchID() {
		args = append(args, tenant.BranchID)
		where = append(where, fmt.Sprintf("e.branch_id = $%d", len(args)))
	}

	switch status {
	case "terminated":
		where = append(where, "e.employment_end_date IS NOT NULL")
	case "all":
		// no extra filter
	default: // active
		where = append(where, "e.employment_end_date IS NULL")
	}

	if id := strings.TrimSpace(employeeTypeID); id != "" {
		args = append(args, id)
		where = append(where, fmt.Sprintf("e.employee_type_id = $%d", len(args)))
	}

	if s := strings.TrimSpace(search); s != "" {
		val := "%" + strings.ToLower(s) + "%"
		args = append(args, val, val, val)
		where = append(where, fmt.Sprintf("(LOWER(e.employee_number) LIKE $%d OR LOWER(e.first_name) LIKE $%d OR LOWER(e.last_name) LIKE $%d)", len(args)-2, len(args)-1, len(args)))
	}

	if hasOutstandingDebt {
		where = append(where, "EXISTS (SELECT 1 FROM payroll_accumulation pa WHERE pa.employee_id = e.id AND pa.accum_type = 'loan_outstanding' AND pa.amount > 0)")
	}

	whereClause := strings.Join(where, " AND ")

	args = append(args, limit, offset)
	query := fmt.Sprintf(`
SELECT 
  e.id,
  e.employee_number,
  (pt.name_th || e.first_name || ' ' || e.last_name || COALESCE(' (' || NULLIF(e.nickname, '') || ')', '')) AS full_name_th,
  pt.name_th AS title_name,
  et.name_th AS employee_type_name,
  e.phone,
  e.email,
  e.photo_id,
  e.employment_start_date,
  CASE WHEN e.employment_end_date IS NULL THEN 'active' ELSE 'terminated' END AS status
FROM employees e
JOIN person_title pt ON pt.id = e.title_id
JOIN employee_type et ON et.id = e.employee_type_id
WHERE %s
ORDER BY e.employee_number ASC
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

	countArgs := args[:len(args)-2]
	countQuery := fmt.Sprintf("SELECT COUNT(1) FROM employees e WHERE %s", whereClause)
	var total int
	if err := db.GetContext(ctx, &total, countQuery, countArgs...); err != nil {
		return ListResult{}, err
	}

	if list == nil {
		list = make([]ListRecord, 0)
	}
	return ListResult{Rows: list, Total: total}, nil
}

func (r Repository) FindEmployeeTypeIDByCode(ctx context.Context, code string) (*uuid.UUID, error) {
	db := r.dbCtx(ctx)
	var id uuid.UUID
	const q = `SELECT id FROM employee_type WHERE code=$1 LIMIT 1`
	if err := db.GetContext(ctx, &id, q, code); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &id, nil
}

func (r Repository) GetIDDocumentTypeCode(ctx context.Context, id uuid.UUID) (string, error) {
	db := r.dbCtx(ctx)
	var code string
	const q = `SELECT code FROM id_document_type WHERE id=$1 LIMIT 1`
	if err := db.GetContext(ctx, &code, q, id); err != nil {
		return "", err
	}
	return code, nil
}

// GetEmployeeTypeCode returns the code (full_time/part_time) for the given employee_type_id
func (r Repository) GetEmployeeTypeCode(ctx context.Context, id uuid.UUID) (string, error) {
	db := r.dbCtx(ctx)
	var code string
	const q = `SELECT code FROM employee_type WHERE id=$1 LIMIT 1`
	if err := db.GetContext(ctx, &code, q, id); err != nil {
		return "", err
	}
	return code, nil
}

// CheckEmployeeNumberExists checks if an employee number already exists for active employees
// excludeID can be specified to exclude a specific employee (for edit mode)
// Note: This checks at the COMPANY level (not branch) to match the database unique constraint
func (r Repository) CheckEmployeeNumberExists(ctx context.Context, tenant contextx.TenantInfo, employeeNumber string, excludeID uuid.UUID) (bool, error) {
	db := r.dbCtx(ctx)

	var exists bool
	args := []interface{}{employeeNumber, tenant.CompanyID}

	q := `SELECT EXISTS (
		SELECT 1 FROM employees 
		WHERE LOWER(employee_number) = LOWER($1)
		  AND company_id = $2
		  AND employment_end_date IS NULL
		  AND deleted_at IS NULL`

	if excludeID != uuid.Nil {
		q += ` AND id != $3`
		args = append(args, excludeID)
	}

	q += `)`

	if err := db.GetContext(ctx, &exists, q, args...); err != nil {
		return false, err
	}
	return exists, nil
}

func (r Repository) Get(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID) (*DetailRecord, error) {
	db := r.dbCtx(ctx)
	q := `
SELECT 
  e.id,
  e.employee_number,
  e.company_id,
  e.branch_id,
  e.title_id,
  e.first_name,
  e.last_name,
  e.nickname,
  e.id_document_type_id,
  e.id_document_number,
  e.id_document_other_description,
  e.phone,
  e.email,
  e.photo_id,
  e.employee_type_id,
  e.department_id,
  e.position_id,
  e.base_pay_amount,
  e.employment_start_date,
  e.employment_end_date,
  e.bank_name,
  e.bank_account_no,
  e.sso_contribute,
  e.sso_declared_wage,
  e.sso_hospital_name,
  e.provident_fund_contribute,
  e.provident_fund_rate_employee,
  e.provident_fund_rate_employer,
  e.withhold_tax,
  e.allow_housing,
  e.allow_water,
  e.allow_electric,
  e.allow_internet,
  e.allow_doctor_fee,
  e.allow_attendance_bonus_nolate,
  e.allow_attendance_bonus_noleave,
  e.created_at,
  e.updated_at,
  CASE WHEN e.employment_end_date IS NULL THEN 'active' ELSE 'terminated' END AS status,
  pt.name_th AS title_name
FROM employees e
LEFT JOIN person_title pt ON pt.id = e.title_id
WHERE e.id = $1 AND e.company_id = $2 AND e.deleted_at IS NULL
LIMIT 1`
	args := []interface{}{id, tenant.CompanyID}
	if tenant.HasBranchID() {
		q = strings.Replace(q, "WHERE e.id = $1 AND e.company_id = $2 AND e.deleted_at IS NULL",
			"WHERE e.id = $1 AND e.company_id = $2 AND e.branch_id = $3 AND e.deleted_at IS NULL", 1)
		args = append(args, tenant.BranchID)
	}
	var rec DetailRecord
	if err := db.GetContext(ctx, &rec, q, args...); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) ListAccum(ctx context.Context, employeeID uuid.UUID) ([]AccumRecord, error) {
	db := r.dbCtx(ctx)
	const q = `SELECT id, accum_type, accum_year, amount, updated_at, updated_by FROM payroll_accumulation WHERE employee_id=$1 ORDER BY accum_type, COALESCE(accum_year, -1)`
	var out []AccumRecord
	if err := db.SelectContext(ctx, &out, q, employeeID); err != nil {
		return nil, err
	}
	return out, nil
}

func (r Repository) CreateAccum(ctx context.Context, employeeID uuid.UUID, rec AccumRecord, actor uuid.UUID) (*AccumRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
INSERT INTO payroll_accumulation (employee_id, accum_type, accum_year, amount, updated_by)
VALUES ($1,$2,$3,$4,$5)
ON CONFLICT (employee_id, accum_type, COALESCE(accum_year, -1))
DO UPDATE SET amount = EXCLUDED.amount, updated_by = EXCLUDED.updated_by
RETURNING id, accum_type, accum_year, amount, updated_at, updated_by`
	var out AccumRecord
	if err := db.GetContext(ctx, &out, q, employeeID, rec.AccumType, rec.AccumYear, rec.Amount, actor); err != nil {
		return nil, err
	}
	return &out, nil
}

func (r Repository) DeleteAccum(ctx context.Context, id uuid.UUID) error {
	db := r.dbCtx(ctx)
	res, err := db.ExecContext(ctx, `DELETE FROM payroll_accumulation WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r Repository) Create(ctx context.Context, payload DetailRecord, companyID, branchID, actor uuid.UUID) (*DetailRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
INSERT INTO employees (
  employee_number, title_id, first_name, last_name, nickname,
  id_document_type_id, id_document_number, id_document_other_description,
  phone, email, photo_id, employee_type_id, department_id, position_id, base_pay_amount,
  employment_start_date, employment_end_date,
  bank_name, bank_account_no,
  sso_contribute, sso_declared_wage, sso_hospital_name,
  provident_fund_contribute, provident_fund_rate_employee, provident_fund_rate_employer,
  withhold_tax,
  allow_housing, allow_water, allow_electric, allow_internet, allow_doctor_fee,
  allow_attendance_bonus_nolate, allow_attendance_bonus_noleave,
	company_id, branch_id,
  created_by, updated_by
) VALUES (
  :employee_number, :title_id, :first_name, :last_name, :nickname,
  :id_document_type_id, :id_document_number, :id_document_other_description,
  :phone, :email, :photo_id, :employee_type_id, :department_id, :position_id, :base_pay_amount,
  :employment_start_date, :employment_end_date,
  :bank_name, :bank_account_no,
  :sso_contribute, :sso_declared_wage, :sso_hospital_name,
  :provident_fund_contribute, :provident_fund_rate_employee, :provident_fund_rate_employer,
  :withhold_tax,
  :allow_housing, :allow_water, :allow_electric, :allow_internet, :allow_doctor_fee,
  :allow_attendance_bonus_nolate, :allow_attendance_bonus_noleave,
  :company_id, :branch_id,
  :created_by, :updated_by
) RETURNING *`

	payload.CreatedAt = time.Now()
	payload.UpdatedAt = payload.CreatedAt

	// use NamedQuery via sqlx
	stmt, err := db.PrepareNamedContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer stmt.Close()

	params := map[string]interface{}{
		"employee_number":                payload.EmployeeNumber,
		"title_id":                       payload.TitleID,
		"first_name":                     payload.FirstName,
		"last_name":                      payload.LastName,
		"nickname":                       payload.Nickname,
		"id_document_type_id":            payload.IDDocumentTypeID,
		"id_document_number":             payload.IDDocumentNumber,
		"id_document_other_description":  payload.IDDocumentOtherDescription,
		"phone":                          payload.Phone,
		"email":                          payload.Email,
		"photo_id":                       payload.PhotoID,
		"employee_type_id":               payload.EmployeeTypeID,
		"department_id":                  payload.DepartmentID,
		"position_id":                    payload.PositionID,
		"base_pay_amount":                payload.BasePayAmount,
		"employment_start_date":          payload.EmploymentStartDate,
		"employment_end_date":            payload.EmploymentEndDate,
		"bank_name":                      payload.BankName,
		"bank_account_no":                payload.BankAccountNo,
		"sso_contribute":                 payload.SSOContribute,
		"sso_declared_wage":              payload.SSODeclaredWage,
		"sso_hospital_name":              payload.SSOHospitalName,
		"provident_fund_contribute":      payload.ProvidentFundContribute,
		"provident_fund_rate_employee":   payload.ProvidentFundRateEmployee,
		"provident_fund_rate_employer":   payload.ProvidentFundRateEmployer,
		"withhold_tax":                   payload.WithholdTax,
		"allow_housing":                  payload.AllowHousing,
		"allow_water":                    payload.AllowWater,
		"allow_electric":                 payload.AllowElectric,
		"allow_internet":                 payload.AllowInternet,
		"allow_doctor_fee":               payload.AllowDoctorFee,
		"allow_attendance_bonus_nolate":  payload.AllowAttendanceBonusNoLate,
		"allow_attendance_bonus_noleave": payload.AllowAttendanceBonusNoLeave,
		"company_id":                     companyID,
		"branch_id":                      branchID,
		"created_by":                     actor,
		"updated_by":                     actor,
	}

	var rec DetailRecord
	if err := stmt.GetContext(ctx, &rec, params); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) Update(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID, payload DetailRecord, actor uuid.UUID) (*DetailRecord, error) {
	db := r.dbCtx(ctx)
	q := `
UPDATE employees SET
  employee_number=:employee_number,
  title_id=:title_id,
  first_name=:first_name,
  last_name=:last_name,
  nickname=:nickname,
  id_document_type_id=:id_document_type_id,
  id_document_number=:id_document_number,
  id_document_other_description=:id_document_other_description,
  phone=:phone,
  email=:email,
  photo_id=:photo_id,
  employee_type_id=:employee_type_id,
  department_id=:department_id,
  position_id=:position_id,
  base_pay_amount=:base_pay_amount,
  employment_start_date=:employment_start_date,
  employment_end_date=:employment_end_date,
  bank_name=:bank_name,
  bank_account_no=:bank_account_no,
  sso_contribute=:sso_contribute,
  sso_declared_wage=:sso_declared_wage,
  sso_hospital_name=:sso_hospital_name,
  provident_fund_contribute=:provident_fund_contribute,
  provident_fund_rate_employee=:provident_fund_rate_employee,
  provident_fund_rate_employer=:provident_fund_rate_employer,
  withhold_tax=:withhold_tax,
  allow_housing=:allow_housing,
  allow_water=:allow_water,
  allow_electric=:allow_electric,
  allow_internet=:allow_internet,
  allow_doctor_fee=:allow_doctor_fee,
  allow_attendance_bonus_nolate=:allow_attendance_bonus_nolate,
  allow_attendance_bonus_noleave=:allow_attendance_bonus_noleave,
  updated_by=:updated_by
WHERE id=:id AND company_id=:company_id AND deleted_at IS NULL
RETURNING *`
	if tenant.HasBranchID() {
		q = strings.Replace(q,
			"WHERE id=:id AND company_id=:company_id AND deleted_at IS NULL",
			"WHERE id=:id AND company_id=:company_id AND branch_id=:branch_id AND deleted_at IS NULL",
			1,
		)
	}

	stmt, err := db.PrepareNamedContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer stmt.Close()

	params := map[string]interface{}{
		"id":                             id,
		"company_id":                     tenant.CompanyID,
		"employee_number":                payload.EmployeeNumber,
		"title_id":                       payload.TitleID,
		"first_name":                     payload.FirstName,
		"last_name":                      payload.LastName,
		"nickname":                       payload.Nickname,
		"id_document_type_id":            payload.IDDocumentTypeID,
		"id_document_number":             payload.IDDocumentNumber,
		"id_document_other_description":  payload.IDDocumentOtherDescription,
		"phone":                          payload.Phone,
		"email":                          payload.Email,
		"photo_id":                       payload.PhotoID,
		"employee_type_id":               payload.EmployeeTypeID,
		"department_id":                  payload.DepartmentID,
		"position_id":                    payload.PositionID,
		"base_pay_amount":                payload.BasePayAmount,
		"employment_start_date":          payload.EmploymentStartDate,
		"employment_end_date":            payload.EmploymentEndDate,
		"bank_name":                      payload.BankName,
		"bank_account_no":                payload.BankAccountNo,
		"sso_contribute":                 payload.SSOContribute,
		"sso_declared_wage":              payload.SSODeclaredWage,
		"sso_hospital_name":              payload.SSOHospitalName,
		"provident_fund_contribute":      payload.ProvidentFundContribute,
		"provident_fund_rate_employee":   payload.ProvidentFundRateEmployee,
		"provident_fund_rate_employer":   payload.ProvidentFundRateEmployer,
		"withhold_tax":                   payload.WithholdTax,
		"allow_housing":                  payload.AllowHousing,
		"allow_water":                    payload.AllowWater,
		"allow_electric":                 payload.AllowElectric,
		"allow_internet":                 payload.AllowInternet,
		"allow_doctor_fee":               payload.AllowDoctorFee,
		"allow_attendance_bonus_nolate":  payload.AllowAttendanceBonusNoLate,
		"allow_attendance_bonus_noleave": payload.AllowAttendanceBonusNoLeave,
		"updated_by":                     actor,
	}
	if tenant.HasBranchID() {
		params["branch_id"] = tenant.BranchID
	}

	var rec DetailRecord
	if err := stmt.GetContext(ctx, &rec, params); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) SoftDelete(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	q := `UPDATE employees SET deleted_at = now(), deleted_by = $1 WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL`
	args := []interface{}{actor, id, tenant.CompanyID}
	if tenant.HasBranchID() {
		q = `UPDATE employees SET deleted_at = now(), deleted_by = $1 WHERE id = $2 AND company_id = $3 AND branch_id = $4 AND deleted_at IS NULL`
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

func (r Repository) InsertPhoto(ctx context.Context, input PhotoRecord) (*PhotoRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
WITH ins AS (
  INSERT INTO employee_photo (company_id, file_name, content_type, file_size_bytes, data, checksum_md5, created_by)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  ON CONFLICT (company_id, checksum_md5) DO NOTHING
  RETURNING id, company_id, file_name, content_type, file_size_bytes, checksum_md5, created_at, created_by
)
SELECT id, company_id, file_name, content_type, file_size_bytes, checksum_md5, created_at, created_by
FROM ins
UNION ALL
SELECT id, company_id, file_name, content_type, file_size_bytes, checksum_md5, created_at, created_by
FROM employee_photo
WHERE company_id = $1 AND checksum_md5 = $6
LIMIT 1`

	var rec PhotoRecord
	if err := db.GetContext(ctx, &rec,
		q,
		input.CompanyID,
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

func (r Repository) GetPhoto(ctx context.Context, id, companyID uuid.UUID) (*PhotoRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
SELECT id, company_id, file_name, content_type, file_size_bytes, data, checksum_md5, created_at, created_by
FROM employee_photo
WHERE id = $1 AND company_id = $2
LIMIT 1`
	var rec PhotoRecord
	if err := db.GetContext(ctx, &rec, q, id, companyID); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) ClearEmployeePhoto(ctx context.Context, employeeID uuid.UUID, actor uuid.UUID) (*uuid.UUID, error) {
	db := r.dbCtx(ctx)
	const q = `
WITH prev AS (
  SELECT id, photo_id
  FROM employees
  WHERE id = $2 AND deleted_at IS NULL
)
UPDATE employees e
SET
  photo_id = NULL,
  updated_by = $1
FROM prev
WHERE e.id = prev.id
RETURNING prev.photo_id`

	var prevPhotoID *uuid.UUID
	if err := db.GetContext(ctx, &prevPhotoID, q, actor, employeeID); err != nil {
		return nil, err
	}
	return prevPhotoID, nil
}

func (r Repository) DeletePhoto(ctx context.Context, id uuid.UUID) error {
	db := r.dbCtx(ctx)
	const q = `
DELETE FROM employee_photo ep
WHERE ep.id = $1
  AND NOT EXISTS (SELECT 1 FROM employees e WHERE e.photo_id = ep.id)`

	res, err := db.ExecContext(ctx, q, id)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func IsUniqueViolation(err error) bool {
	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		return pqErr.Code == "23505"
	}
	return false
}
