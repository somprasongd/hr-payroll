package pt

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
	"hrms/shared/events"
)

type CreateRequest struct {
	EmployeeID uuid.UUID `json:"employeeId"`
	WorkDate   string    `json:"workDate"`
	MorningIn  *string   `json:"morningIn"`
	MorningOut *string   `json:"morningOut"`
	EveningIn  *string   `json:"eveningIn"`
	EveningOut *string   `json:"eveningOut"`
	Status     string    `json:"status"` // pending|approved
}

type CreateCommand struct {
	Payload CreateRequest
	Repo    repository.PTRepository
	Tx      transactor.Transactor
	Eb      eventbus.EventBus
}

type CreateResponse struct {
	dto.PTItem
}

type createHandler struct{}

func NewCreateHandler() *createHandler { return &createHandler{} }

func (h *createHandler) Handle(ctx context.Context, cmd *CreateCommand) (*CreateResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing user context")
	}

	parsedDate, err := validatePayload(&cmd.Payload)
	if err != nil {
		return nil, err
	}

	rec := repository.PTRecord{
		EmployeeID: cmd.Payload.EmployeeID,
		WorkDate:   parsedDate,
		MorningIn:  cmd.Payload.MorningIn,
		MorningOut: cmd.Payload.MorningOut,
		EveningIn:  cmd.Payload.EveningIn,
		EveningOut: cmd.Payload.EveningOut,
		Status:     cmd.Payload.Status,
		CreatedBy:  user.ID,
		UpdatedBy:  user.ID,
	}

	var created *repository.PTRecord
	if err := cmd.Tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		exists, err := cmd.Repo.ExistsActiveByEmployeeDate(ctxTx, rec.EmployeeID, rec.WorkDate)
		if err != nil {
			return err
		}
		if exists {
			return errs.Conflict("worklog already exists for this employee on this date")
		}

		created, err = cmd.Repo.Insert(ctxTx, tenant, rec)
		if err != nil {
			if repository.IsUniqueErrPT(err) {
				return errs.Conflict("worklog already exists for this employee on this date")
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

	cmd.Eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &tenant.CompanyID,
		BranchID:   tenant.BranchIDPtr(),
		Action:     "CREATE",
		EntityName: "WORKLOG_PT",
		EntityID:   created.ID.String(),
		Details: map[string]interface{}{
			"employee_id": created.EmployeeID.String(),
			"work_date":   created.WorkDate.Format("2006-01-02"),
			"morning_in":  created.MorningIn,
			"morning_out": created.MorningOut,
			"evening_in":  created.EveningIn,
			"evening_out": created.EveningOut,
		},
		Timestamp: time.Now(),
	})

	return &CreateResponse{PTItem: dto.FromPT(*created)}, nil
}

func validatePayload(p *CreateRequest) (time.Time, error) {
	if p.EmployeeID == uuid.Nil {
		return time.Time{}, errs.BadRequest("employeeId is required")
	}
	dateStr := strings.TrimSpace(p.WorkDate)
	if dateStr == "" {
		return time.Time{}, errs.BadRequest("workDate is required")
	}
	parsedDate, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return time.Time{}, errs.BadRequest("workDate must be YYYY-MM-DD")
	}
	p.Status = strings.TrimSpace(p.Status)
	if p.Status == "" {
		p.Status = "pending"
	}
	if p.Status != "pending" && p.Status != "approved" {
		return time.Time{}, errs.BadRequest("invalid status")
	}
	// time pairing is enforced by DB; just ensure strings look like HH:MM?
	for _, t := range []**string{&p.MorningIn, &p.MorningOut, &p.EveningIn, &p.EveningOut} {
		if *t != nil && **t == "" {
			*t = nil
		}
		if *t != nil {
			if _, err := time.Parse("15:04", **t); err != nil {
				return time.Time{}, errs.BadRequest("time format must be HH:MM")
			}
		}
	}
	return parsedDate, nil
}

type UpdateRequest struct {
	WorkDate   string  `json:"workDate"`
	MorningIn  *string `json:"morningIn"`
	MorningOut *string `json:"morningOut"`
	EveningIn  *string `json:"eveningIn"`
	EveningOut *string `json:"eveningOut"`
	Status     string  `json:"status"` // pending|approved
}

type UpdateCommand struct {
	ID      uuid.UUID
	Payload UpdateRequest
	Repo    repository.PTRepository
	Tx      transactor.Transactor
	Eb      eventbus.EventBus
}

type UpdateResponse struct {
	dto.PTItem
}

type updateHandler struct{}

func NewUpdateHandler() *updateHandler { return &updateHandler{} }

func (h *updateHandler) Handle(ctx context.Context, cmd *UpdateCommand) (*UpdateResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing user context")
	}

	current, err := cmd.Repo.Get(ctx, tenant, cmd.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("worklog not found")
		}
		logger.FromContext(ctx).Error("failed to load worklog", zap.Error(err))
		return nil, errs.Internal("failed to load worklog")
	}

	parsedDate, morningIn, morningOut, eveningIn, eveningOut, status, err := normalizeUpdatePayload(&cmd.Payload, current)
	if err != nil {
		return nil, err
	}

	if current.Status == "approved" && status != "approved" {
		return nil, errs.BadRequest("cannot revert approved worklog")
	}

	rec := repository.PTRecord{
		WorkDate:   parsedDate,
		MorningIn:  morningIn,
		MorningOut: morningOut,
		EveningIn:  eveningIn,
		EveningOut: eveningOut,
		Status:     status,
		UpdatedBy:  user.ID,
	}

	var updated *repository.PTRecord
	err = cmd.Tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		updated, err = cmd.Repo.Update(ctxTx, tenant, cmd.ID, rec)
		return err
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("worklog not found")
		}
		logger.FromContext(ctx).Error("failed to update worklog", zap.Error(err))
		return nil, errs.Internal("failed to update worklog")
	}

	details := map[string]interface{}{}
	if !parsedDate.Equal(current.WorkDate) {
		details["work_date"] = parsedDate.Format("2006-01-02")
	}
	if morningIn != current.MorningIn {
		details["morning_in"] = morningIn
	}
	if morningOut != current.MorningOut {
		details["morning_out"] = morningOut
	}
	if eveningIn != current.EveningIn {
		details["evening_in"] = eveningIn
	}
	if eveningOut != current.EveningOut {
		details["evening_out"] = eveningOut
	}
	if status != current.Status {
		details["status"] = status
	}

	cmd.Eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &tenant.CompanyID,
		BranchID:   tenant.BranchIDPtr(),
		Action:     "UPDATE",
		EntityName: "WORKLOG_PT",
		EntityID:   updated.ID.String(),
		Details:    details,
		Timestamp:  time.Now(),
	})

	return &UpdateResponse{PTItem: dto.FromPT(*updated)}, nil
}

func normalizeUpdatePayload(p *UpdateRequest, current *repository.PTRecord) (time.Time, *string, *string, *string, *string, string, error) {
	// work date (fallback to current)
	var workDate time.Time
	if strings.TrimSpace(p.WorkDate) == "" {
		workDate = current.WorkDate
	} else {
		d, err := time.Parse("2006-01-02", strings.TrimSpace(p.WorkDate))
		if err != nil {
			return time.Time{}, nil, nil, nil, nil, "", errs.BadRequest("workDate must be YYYY-MM-DD")
		}
		workDate = d
	}

	// time fields: keep current if nil; empty string means clear
	parseTime := func(val *string, currentVal *string, field string) (*string, error) {
		if val == nil {
			return currentVal, nil
		}
		trimmed := strings.TrimSpace(*val)
		if trimmed == "" {
			return nil, nil // Implicitly set to NULL (nil pointer returns nil)
		}
		if _, err := time.Parse("15:04", trimmed); err != nil {
			return nil, errs.BadRequest(field+" must be HH:MM")
		}
		return &trimmed, nil
	}

	mIn, err := parseTime(p.MorningIn, current.MorningIn, "morningIn")
	if err != nil {
		return time.Time{}, nil, nil, nil, nil, "", err
	}
	mOut, err := parseTime(p.MorningOut, current.MorningOut, "morningOut")
	if err != nil {
		return time.Time{}, nil, nil, nil, nil, "", err
	}
	eIn, err := parseTime(p.EveningIn, current.EveningIn, "eveningIn")
	if err != nil {
		return time.Time{}, nil, nil, nil, nil, "", err
	}
	eOut, err := parseTime(p.EveningOut, current.EveningOut, "eveningOut")
	if err != nil {
		return time.Time{}, nil, nil, nil, nil, "", err
	}

	status := strings.TrimSpace(p.Status)
	if status == "" {
		status = current.Status
	}
	if status != "pending" && status != "approved" {
		return time.Time{}, nil, nil, nil, nil, "", errs.BadRequest("invalid status")
	}

	return workDate, mIn, mOut, eIn, eOut, status, nil
}

type DeleteCommand struct {
	ID   uuid.UUID
	Repo repository.PTRepository
	Eb   eventbus.EventBus
}

type deleteHandler struct{}

func NewDeleteHandler() *deleteHandler { return &deleteHandler{} }

func (h *deleteHandler) Handle(ctx context.Context, cmd *DeleteCommand) (mediator.NoResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return mediator.NoResponse{}, errs.Unauthorized("missing tenant context")
	}

	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return mediator.NoResponse{}, errs.Unauthorized("missing user context")
	}

	rec, err := cmd.Repo.Get(ctx, tenant, cmd.ID)
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
	if err := cmd.Repo.SoftDelete(ctx, tenant, cmd.ID, user.ID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("worklog not found")
		}
		logger.FromContext(ctx).Error("failed to delete worklog", zap.Error(err))
		return mediator.NoResponse{}, errs.Internal("failed to delete worklog")
	}

	cmd.Eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &tenant.CompanyID,
		BranchID:   tenant.BranchIDPtr(),
		Action:     "DELETE",
		EntityName: "WORKLOG_PT",
		EntityID:   cmd.ID.String(),
		Timestamp:  time.Now(),
	})

	return mediator.NoResponse{}, nil
}
