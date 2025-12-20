package repository

import (
	"context"
	"fmt"
	"strings"

	"hrms/modules/activitylog/internal/entity"
	"hrms/shared/common/contextx"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Repository struct {
	dbCtx transactor.DBTXContext
}

func NewRepository(dbCtx transactor.DBTXContext) *Repository {
	return &Repository{dbCtx: dbCtx}
}

type ListFilter struct {
	Action   string
	Entity   string
	FromDate string
	ToDate   string
	UserName string
}

func (r *Repository) CreateLog(ctx context.Context, log *entity.ActivityLog) error {
	db := r.dbCtx(ctx)
	var details interface{}
	if len(log.Details) > 0 {
		details = log.Details
	}
	query := `
		INSERT INTO activity_logs (user_id, company_id, branch_id, action, entity, entity_id, details, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`
	return db.QueryRowContext(ctx, query,
		log.UserID,
		log.CompanyID,
		log.BranchID,
		log.Action,
		log.Entity,
		log.EntityID,
		details,
		log.CreatedAt,
	).Scan(&log.ID)
}

func (r *Repository) ListLogs(ctx context.Context, tenant contextx.TenantInfo, filter ListFilter, page, limit int) ([]entity.ActivityLog, int, error) {
	db := r.dbCtx(ctx)
	offset := (page - 1) * limit

	var where []string
	var args []interface{}

	// Company Filter
	args = append(args, tenant.CompanyID)
	where = append(where, fmt.Sprintf("l.company_id = $%d", len(args)))

	// Branch Filter
	if tenant.HasBranchID() {
		args = append(args, tenant.BranchID)
		where = append(where, fmt.Sprintf("l.branch_id = $%d", len(args)))
	}

	if filter.Action != "" {
		args = append(args, filter.Action)
		where = append(where, fmt.Sprintf("l.action = $%d", len(args)))
	}
	if filter.Entity != "" {
		args = append(args, filter.Entity)
		where = append(where, fmt.Sprintf("l.entity = $%d", len(args)))
	}

	// UserName filter
	if filter.UserName != "" {
		args = append(args, "%"+filter.UserName+"%")
		where = append(where, fmt.Sprintf("u.username ILIKE $%d", len(args)))
	}

	// Simplified date filter for now, can be enhanced
	if filter.FromDate != "" {
		args = append(args, filter.FromDate)
		where = append(where, fmt.Sprintf("l.created_at >= $%d", len(args)))
	}
	if filter.ToDate != "" {
		// Append end of day time to include the whole day
		args = append(args, filter.ToDate+" 23:59:59")
		where = append(where, fmt.Sprintf("l.created_at <= $%d", len(args)))
	}

	whereClause := ""
	if len(where) > 0 {
		whereClause = "WHERE " + strings.Join(where, " AND ")
	}

	// Count query
	// Always LEFT JOIN to ensure we count logs even if user is somehow missing (though referential integrity should prevent it usually)
	// COALESCE(u.username, '') handles nulls if we search by username
	totalQuery := fmt.Sprintf(`
		SELECT COUNT(*) 
		FROM activity_logs l 
		LEFT JOIN users u ON l.user_id = u.id 
		%s
	`, whereClause)

	var total int
	if err := db.GetContext(ctx, &total, totalQuery, args...); err != nil {
		return nil, 0, err
	}

	args = append(args, limit, offset)
	// Use COALESCE in SELECT to avoid Scan error on NULL username
	query := fmt.Sprintf(`
		SELECT
			l.id,
			l.user_id,
			l.action,
			l.entity,
			l.entity_id,
			COALESCE(l.details, '{}'::jsonb) AS details,
			l.created_at,
			COALESCE(u.username, 'Unknown') as user_name
		FROM activity_logs l
		LEFT JOIN users u ON l.user_id = u.id
		%s
		ORDER BY l.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, len(args)-1, len(args))

	var logs []entity.ActivityLog
	if err := db.SelectContext(ctx, &logs, query, args...); err != nil {
		return nil, 0, err
	}

	if logs == nil {
		logs = []entity.ActivityLog{}
	}

	return logs, total, nil
}

type FilterOptions struct {
	Actions  []string `json:"actions"`
	Entities []string `json:"entities"`
}

func (r *Repository) GetDistinctFilters(ctx context.Context, tenant contextx.TenantInfo) (*FilterOptions, error) {
	db := r.dbCtx(ctx)

	var actions []string
	actionsQuery := `SELECT DISTINCT action FROM activity_logs WHERE company_id = $1 ORDER BY action`
	if err := db.SelectContext(ctx, &actions, actionsQuery, tenant.CompanyID); err != nil {
		return nil, err
	}

	var entities []string
	entitiesQuery := `SELECT DISTINCT entity FROM activity_logs WHERE company_id = $1 ORDER BY entity`
	if err := db.SelectContext(ctx, &entities, entitiesQuery, tenant.CompanyID); err != nil {
		return nil, err
	}

	if actions == nil {
		actions = []string{}
	}
	if entities == nil {
		entities = []string{}
	}

	return &FilterOptions{Actions: actions, Entities: entities}, nil
}
