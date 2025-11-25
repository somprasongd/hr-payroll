package ft

import (
	"context"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/worklog/internal/dto"
	"hrms/modules/worklog/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
	"hrms/shared/common/storage/sqldb/transactor"
)

type CreateCommand struct {
	Payload CreateRequest
	ActorID uuid.UUID
	Repo    repository.FTRepository
	Tx      transactor.Transactor
}

type CreateResponse struct {
	dto.FTItem
}

type createHandler struct{}

func NewCreateHandler() *createHandler { return &createHandler{} }

func (h *createHandler) Handle(ctx context.Context, cmd *CreateCommand) (*CreateResponse, error) {
	if err := validateFTPayload(cmd.Payload); err != nil {
		return nil, err
	}
	rec := repository.FTRecord{
		EmployeeID: cmd.Payload.EmployeeID,
		EntryType:  cmd.Payload.EntryType,
		WorkDate:   cmd.Payload.WorkDate,
		Quantity:   cmd.Payload.Quantity,
		Status:     "pending",
		CreatedBy:  cmd.ActorID,
		UpdatedBy:  cmd.ActorID,
	}

	var created *repository.FTRecord
	if err := cmd.Tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		created, err = cmd.Repo.Insert(ctxTx, rec)
		return err
	}); err != nil {
		logger.FromContext(ctx).Error("failed to create worklog", zap.Error(err))
		return nil, errs.Internal("failed to create worklog")
	}

	return &CreateResponse{FTItem: dto.FromFT(*created)}, nil
}

type CreateRequest struct {
	EmployeeID uuid.UUID `json:"employeeId"`
	EntryType  string    `json:"entryType"`
	WorkDate   time.Time `json:"workDate"`
	Quantity   float64   `json:"quantity"`
}

func validateFTPayload(p CreateRequest) error {
	if p.EmployeeID == uuid.Nil {
		return errs.BadRequest("employeeId is required")
	}
	entry := strings.TrimSpace(p.EntryType)
	switch entry {
	case "late", "leave_day", "leave_double", "leave_hours", "ot":
	default:
		return errs.BadRequest("invalid entryType")
	}
	if p.WorkDate.IsZero() {
		return errs.BadRequest("workDate is required")
	}
	if p.Quantity <= 0 {
		return errs.BadRequest("quantity must be > 0")
	}
	return nil
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
// @Router /worklogs/ft [post]
func registerCreate(router fiber.Router, repo repository.FTRepository, tx transactor.Transactor) {
	router.Post("/", func(c fiber.Ctx) error {
		var req CreateRequest
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		resp, err := mediator.Send[*CreateCommand, *CreateResponse](c.Context(), &CreateCommand{
			Payload: req,
			ActorID: user.ID,
			Repo:    repo,
			Tx:      tx,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusCreated, resp.FTItem)
	})
}
