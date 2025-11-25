package pt

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
	Repo    repository.PTRepository
	Tx      transactor.Transactor
}

type CreateResponse struct {
	dto.PTItem
}

type createHandler struct{}

func NewCreateHandler() *createHandler { return &createHandler{} }

type CreateRequest struct {
	EmployeeID uuid.UUID `json:"employeeId"`
	WorkDate   string    `json:"workDate"`
	MorningIn  *string   `json:"morningIn"`
	MorningOut *string   `json:"morningOut"`
	EveningIn  *string   `json:"eveningIn"`
	EveningOut *string   `json:"eveningOut"`
	Status     string    `json:"status"` // pending|approved
}

func (h *createHandler) Handle(ctx context.Context, cmd *CreateCommand) (*CreateResponse, error) {
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
		CreatedBy:  cmd.ActorID,
		UpdatedBy:  cmd.ActorID,
	}

	var created *repository.PTRecord
	if err := cmd.Tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		created, err = cmd.Repo.Insert(ctxTx, rec)
		return err
	}); err != nil {
		logger.FromContext(ctx).Error("failed to create worklog", zap.Error(err))
		return nil, errs.Internal("failed to create worklog")
	}

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
	for _, t := range []*string{p.MorningIn, p.MorningOut, p.EveningIn, p.EveningOut} {
		if t != nil && *t != "" {
			if _, err := time.Parse("15:04", *t); err != nil {
				return time.Time{}, errs.BadRequest("time format must be HH:MM")
			}
		}
	}
	return parsedDate, nil
}

// @Summary Create worklog PT
// @Description บันทึก worklog (Part-time)
// @Tags Worklogs PT
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateRequest true "worklog payload"
// @Success 201 {object} CreateResponse
// @Failure 400
// @Failure 401
// @Failure 403
// @Router /worklogs/pt [post]
func registerCreate(router fiber.Router, repo repository.PTRepository, tx transactor.Transactor) {
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
		return response.JSON(c, fiber.StatusCreated, resp.PTItem)
	})
}
