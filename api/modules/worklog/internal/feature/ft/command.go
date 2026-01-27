package ft

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/worklog/internal/dto"
	"hrms/modules/worklog/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/common/validator"
	"hrms/shared/events"
)

type CreateRequest struct {
	EmployeeID uuid.UUID `json:"employeeId" validate:"required"`
	EntryType  string    `json:"entryType" validate:"required,oneof=late leave_day leave_double leave_hours ot"`
	WorkDate   string    `json:"workDate" validate:"required"`
	Quantity   float64   `json:"quantity" validate:"required,gt=0"`
}

type CreateCommand struct {
	Payload CreateRequest
}

type CreateResponse struct {
	dto.FTItem
}

type createHandler struct {
	repo repository.FTRepository
	tx   transactor.Transactor
	eb   eventbus.EventBus
}

func NewCreateHandler(repo repository.FTRepository, tx transactor.Transactor, eb eventbus.EventBus) *createHandler {
	return &createHandler{repo: repo, tx: tx, eb: eb}
}

func (h *createHandler) Handle(ctx context.Context, cmd *CreateCommand) (*CreateResponse, error) {
	cmd.Payload.EntryType = strings.TrimSpace(cmd.Payload.EntryType)
	if err := validator.Validate(&cmd.Payload); err != nil {
		return nil, err
	}

	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing user context")
	}

	parsedDate, err := parseDate(cmd.Payload.WorkDate)
	if err != nil {
		return nil, err
	}
	entryType := cmd.Payload.EntryType

	rec := repository.FTRecord{
		EmployeeID: cmd.Payload.EmployeeID,
		EntryType:  entryType,
		WorkDate:   parsedDate,
		Quantity:   cmd.Payload.Quantity,
		Status:     "pending",
		CreatedBy:  user.ID,
		UpdatedBy:  user.ID,
	}

	var created *repository.FTRecord
	if err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		exists, err := h.repo.ExistsActiveByEmployeeDateType(ctxTx, rec.EmployeeID, rec.WorkDate, rec.EntryType, nil)
		if err != nil {
			return err
		}
		if exists {
			return errs.Conflict("worklog already exists for this employee, date, and entryType")
		}

		created, err = h.repo.Insert(ctxTx, tenant, rec)
		if err != nil {
			if repository.IsUniqueErrFT(err) {
				return errs.Conflict("worklog already exists for this employee, date, and entryType")
			}
			return err
		}
		return nil
	}); err != nil {
		var appErr *errs.AppError
		if errors.As(err, &appErr) {
			logger.FromContext(ctx).Warn("failed to create worklog", zap.Error(err))
			return nil, err
		}
		logger.FromContext(ctx).Error("failed to create worklog", zap.Error(err))
		return nil, errs.Internal("failed to create worklog")
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &tenant.CompanyID,
		BranchID:   tenant.BranchIDPtr(),
		Action:     "CREATE",
		EntityName: "WORKLOG_FT",
		EntityID:   created.ID.String(),
		Details: map[string]interface{}{
			"employee_id": created.EmployeeID.String(),
			"work_date":   created.WorkDate.Format("2006-01-02"),
			"entry_type":  created.EntryType,
			"quantity":    created.Quantity,
		},
		Timestamp: time.Now(),
	})

	return &CreateResponse{FTItem: dto.FromFT(*created)}, nil
}

func parseDate(dateStr string) (time.Time, error) {
	parsedDate, err := time.Parse("2006-01-02", strings.TrimSpace(dateStr))
	if err != nil {
		return time.Time{}, errs.BadRequest("workDate must be YYYY-MM-DD")
	}
	return parsedDate, nil
}

type UpdateRequest struct {
	EntryType string   `json:"entryType" validate:"omitempty,oneof=late leave_day leave_double leave_hours ot"`
	WorkDate  string   `json:"workDate"`
	Quantity  *float64 `json:"quantity" validate:"omitempty,gt=0"`
	Status    string   `json:"status" validate:"omitempty,oneof=pending approved"`
}

type UpdateCommand struct {
	ID      uuid.UUID `validate:"required"`
	Payload UpdateRequest
}

type UpdateResponse struct {
	dto.FTItem
}

type updateHandler struct {
	repo repository.FTRepository
	tx   transactor.Transactor
	eb   eventbus.EventBus
}

func NewUpdateHandler(repo repository.FTRepository, tx transactor.Transactor, eb eventbus.EventBus) *updateHandler {
	return &updateHandler{repo: repo, tx: tx, eb: eb}
}

func (h *updateHandler) Handle(ctx context.Context, cmd *UpdateCommand) (*UpdateResponse, error) {
	cmd.Payload.EntryType = strings.TrimSpace(cmd.Payload.EntryType)
	cmd.Payload.Status = strings.TrimSpace(cmd.Payload.Status)
	if err := validator.Validate(cmd); err != nil {
		return nil, err
	}

	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing user context")
	}

	current, err := h.repo.Get(ctx, tenant, cmd.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("worklog not found")
		}
		logger.FromContext(ctx).Error("failed to load worklog", zap.Error(err))
		return nil, errs.Internal("failed to load worklog")
	}

	entryType, workDate, quantity, status, err := normalizeUpdatePayload(&cmd.Payload, current)
	if err != nil {
		return nil, err
	}

	// only allow delete/update on pending; status transitions pending->approved allowed; approved cannot change status back
	if current.Status == "approved" && status != "approved" {
		return nil, errs.BadRequest("cannot revert approved worklog")
	}

	rec := repository.FTRecord{
		EntryType: entryType,
		WorkDate:  workDate,
		Quantity:  quantity,
		Status:    status,
		UpdatedBy: user.ID,
	}

	var updated *repository.FTRecord
	err = h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		if entryType != current.EntryType || !workDate.Equal(current.WorkDate) {
			exists, err := h.repo.ExistsActiveByEmployeeDateType(ctxTx, current.EmployeeID, workDate, entryType, &cmd.ID)
			if err != nil {
				return err
			}
			if exists {
				return errs.Conflict("worklog already exists for this employee, date, and entryType")
			}
		}

		updated, err = h.repo.Update(ctxTx, tenant, cmd.ID, rec)
		if err != nil {
			if repository.IsUniqueErrFT(err) {
				return errs.Conflict("worklog already exists for this employee, date, and entryType")
			}
			return err
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("worklog not found")
		}
		var appErr *errs.AppError
		if errors.As(err, &appErr) {
			logger.FromContext(ctx).Warn("failed to update worklog", zap.Error(err))
			return nil, err
		}
		logger.FromContext(ctx).Error("failed to update worklog", zap.Error(err))
		return nil, errs.Internal("failed to update worklog")
	}

	details := map[string]interface{}{}
	if entryType != current.EntryType {
		details["entry_type"] = entryType
	}
	if !workDate.Equal(current.WorkDate) {
		details["work_date"] = workDate.Format("2006-01-02")
	}
	if quantity != current.Quantity {
		details["quantity"] = quantity
	}
	if status != current.Status {
		details["status"] = status
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &tenant.CompanyID,
		BranchID:   tenant.BranchIDPtr(),
		Action:     "UPDATE",
		EntityName: "WORKLOG_FT",
		EntityID:   updated.ID.String(),
		Details:    details,
		Timestamp:  time.Now(),
	})

	return &UpdateResponse{FTItem: dto.FromFT(*updated)}, nil
}

func normalizeUpdatePayload(p *UpdateRequest, current *repository.FTRecord) (string, time.Time, float64, string, error) {
	entryType := strings.TrimSpace(p.EntryType)
	if entryType == "" {
		entryType = current.EntryType
	} else {
		switch entryType {
		case "late", "leave_day", "leave_double", "leave_hours", "ot":
		default:
			return "", time.Time{}, 0, "", errs.BadRequest("invalid entryType")
		}
	}

	var workDate time.Time
	if strings.TrimSpace(p.WorkDate) == "" {
		workDate = current.WorkDate
	} else {
		parsedDate, err := time.Parse("2006-01-02", strings.TrimSpace(p.WorkDate))
		if err != nil {
			return "", time.Time{}, 0, "", errs.BadRequest("workDate must be YYYY-MM-DD")
		}
		workDate = parsedDate
	}

	var quantity float64
	if p.Quantity == nil {
		quantity = current.Quantity
	} else {
		if *p.Quantity <= 0 {
			return "", time.Time{}, 0, "", errs.BadRequest("quantity must be > 0")
		}
		quantity = *p.Quantity
	}

	status := strings.TrimSpace(p.Status)
	if status == "" {
		status = current.Status
	}
	if status != "pending" && status != "approved" {
		return "", time.Time{}, 0, "", errs.BadRequest("invalid status")
	}

	return entryType, workDate, quantity, status, nil
}

type DeleteCommand struct {
	ID uuid.UUID `validate:"required"`
}

type deleteHandler struct {
	repo repository.FTRepository
	eb   eventbus.EventBus
}

func NewDeleteHandler(repo repository.FTRepository, eb eventbus.EventBus) *deleteHandler {
	return &deleteHandler{repo: repo, eb: eb}
}

func (h *deleteHandler) Handle(ctx context.Context, cmd *DeleteCommand) (mediator.NoResponse, error) {
	if err := validator.Validate(cmd); err != nil {
		return mediator.NoResponse{}, err
	}

	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return mediator.NoResponse{}, errs.Unauthorized("missing tenant context")
	}

	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return mediator.NoResponse{}, errs.Unauthorized("missing user context")
	}

	rec, err := h.repo.Get(ctx, tenant, cmd.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("worklog not found")
		}
		logger.FromContext(ctx).Error("failed to load worklog", zap.Error(err))
		return mediator.NoResponse{}, errs.Internal("failed to load worklog")
	}
	if rec.Status != "pending" {
		return mediator.NoResponse{}, errs.BadRequest("cannot delete non-pending worklog")
	}
	if err := h.repo.SoftDelete(ctx, tenant, cmd.ID, user.ID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("worklog not found")
		}
		logger.FromContext(ctx).Error("failed to delete worklog", zap.Error(err))
		return mediator.NoResponse{}, errs.Internal("failed to delete worklog")
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &tenant.CompanyID,
		BranchID:   tenant.BranchIDPtr(),
		Action:     "DELETE",
		EntityName: "WORKLOG_FT",
		EntityID:   cmd.ID.String(),
		Timestamp:  time.Now(),
	})

	return mediator.NoResponse{}, nil
}
