package updatebyid

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"go.uber.org/zap"

	"hrms/modules/company/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/contracts"
	"hrms/shared/events"
)

type Handler struct {
	repo repository.Repository
	tx   transactor.Transactor
	eb   eventbus.EventBus
}

func NewHandler(repo repository.Repository, tx transactor.Transactor, eb eventbus.EventBus) *Handler {
	return &Handler{
		repo: repo,
		tx:   tx,
		eb:   eb,
	}
}

func (h *Handler) Handle(ctx context.Context, cmd *contracts.UpdateCompanyByIDCommand) (*contracts.UpdateCompanyByIDResponse, error) {
	var company *repository.Company
	err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, registerHook func(transactor.PostCommitHook)) error {
		var err error
		company, err = h.repo.UpdateByID(ctxTx, cmd.ID, cmd.Code, cmd.Name, cmd.Status, cmd.ActorID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return errs.NotFound("company not found")
			}
			logger.FromContext(ctxTx).Error("failed to update company", zap.Error(err))
			return errs.Internal("failed to update company")
		}

		registerHook(func(ctx context.Context) error {
			h.eb.Publish(events.LogEvent{
				ActorID:    cmd.ActorID,
				CompanyID:  &company.ID,
				BranchID:   nil,
				Action:     "UPDATE",
				EntityName: "COMPANY",
				EntityID:   company.ID.String(),
				Details: map[string]interface{}{
					"code":   company.Code,
					"name":   company.Name,
					"status": company.Status,
				},
				Timestamp: time.Now(),
			})
			return nil
		})

		return nil
	})
	if err != nil {
		return nil, err
	}

	return &contracts.UpdateCompanyByIDResponse{
		Company: &contracts.CompanyDTO{
			ID:        company.ID,
			Code:      company.Code,
			Name:      company.Name,
			Status:    company.Status,
			CreatedAt: company.CreatedAt,
			UpdatedAt: company.UpdatedAt,
		},
	}, nil
}
