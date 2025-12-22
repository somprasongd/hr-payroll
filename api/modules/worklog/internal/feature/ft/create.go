package ft

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/worklog/internal/dto"
	"hrms/modules/worklog/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/events"
)

type CreateCommand struct {
	Payload CreateRequest
	Repo    repository.FTRepository
	Tx      transactor.Transactor
	Eb      eventbus.EventBus
}

type CreateResponse struct {
	dto.FTItem
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

	parsedDate, err := validateFTPayload(&cmd.Payload)
	if err != nil {
		return nil, err
	}
	entryType := strings.TrimSpace(cmd.Payload.EntryType)

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
	if err := cmd.Tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		exists, err := cmd.Repo.ExistsActiveByEmployeeDateType(ctxTx, rec.EmployeeID, rec.WorkDate, rec.EntryType, nil)
		if err != nil {
			return err
		}
		if exists {
			return errs.Conflict("worklog already exists for this employee, date, and entryType")
		}

		created, err = cmd.Repo.Insert(ctxTx, tenant, rec)
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

	cmd.Eb.Publish(events.LogEvent{
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

type CreateRequest struct {
	EmployeeID uuid.UUID `json:"employeeId"`
	EntryType  string    `json:"entryType"`
	WorkDate   string    `json:"workDate"`
	Quantity   float64   `json:"quantity"`
}

func validateFTPayload(p *CreateRequest) (time.Time, error) {
	if p.EmployeeID == uuid.Nil {
		return time.Time{}, errs.BadRequest("employeeId is required")
	}
	entry := strings.TrimSpace(p.EntryType)
	switch entry {
	case "late", "leave_day", "leave_double", "leave_hours", "ot":
	default:
		return time.Time{}, errs.BadRequest("invalid entryType")
	}
	dateStr := strings.TrimSpace(p.WorkDate)
	if dateStr == "" {
		return time.Time{}, errs.BadRequest("workDate is required")
	}
	parsedDate, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return time.Time{}, errs.BadRequest("workDate must be YYYY-MM-DD")
	}
	if p.Quantity <= 0 {
		return time.Time{}, errs.BadRequest("quantity must be > 0")
	}
	return parsedDate, nil
}

// @Summary Create worklog FT
// @Description บันทึก worklog (Full-time) สถานะเริ่มต้น pending
// @Tags Worklogs FT
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateRequest true "worklog payload"
// @Success 201 {object} CreateResponse
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 409
// @Router /worklogs/ft [post]
func registerCreate(router fiber.Router, repo repository.FTRepository, tx transactor.Transactor, eb eventbus.EventBus) {
	router.Post("/", func(c fiber.Ctx) error {
		var req CreateRequest
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}
		resp, err := mediator.Send[*CreateCommand, *CreateResponse](c.Context(), &CreateCommand{
			Payload: req,
			Repo:    repo,
			Tx:      tx,
			Eb:      eb,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusCreated, resp.FTItem)
	})
}
