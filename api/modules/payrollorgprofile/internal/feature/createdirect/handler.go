package createdirect

import (
	"context"

	"go.uber.org/zap"

	"hrms/modules/payrollorgprofile/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/contracts"
)

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*contracts.CreateOrgProfileDirectCommand, *contracts.CreateOrgProfileDirectResponse] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, cmd *contracts.CreateOrgProfileDirectCommand) (*contracts.CreateOrgProfileDirectResponse, error) {
	status := "active"

	payload := repository.UpsertPayload{
		StartDate:   &cmd.StartDate,
		CompanyName: &cmd.CompanyName,
		Status:      &status,
	}

	created, err := h.repo.CreateDirect(ctx, cmd.CompanyID, payload, cmd.ActorID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to create org profile (direct)", zap.Error(err), zap.String("company_id", cmd.CompanyID.String()))
		return nil, errs.Internal("failed to create org profile")
	}

	return &contracts.CreateOrgProfileDirectResponse{
		ID: created.ID,
	}, nil
}
