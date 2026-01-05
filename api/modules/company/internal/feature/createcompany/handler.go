package createcompany

import (
	"context"
	"time"

	"github.com/lib/pq"
	"go.uber.org/zap"

	"hrms/modules/company/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/contracts"
)

type Handler struct {
	repo repository.Repository
	tx   transactor.Transactor
}

func NewHandler(repo repository.Repository, tx transactor.Transactor) *Handler {
	return &Handler{
		repo: repo,
		tx:   tx,
	}
}

func (h *Handler) Handle(ctx context.Context, cmd *contracts.CreateCompanyCommand) (*contracts.CreateCompanyResponse, error) {
	var company *repository.Company

	err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var txErr error

		// 1. Create company
		company, txErr = h.repo.Create(ctxTx, cmd.Code, cmd.Name, cmd.ActorID)
		if txErr != nil {
			if pqErr, ok := txErr.(*pq.Error); ok && pqErr.Code == "23505" {
				return errs.Conflict("company code already exists")
			}
			logger.FromContext(ctx).Error("failed to create company", zap.Error(txErr))
			return txErr
		}

		// 2. Create default org profile via mediator
		startDate := getFirstDayOfMonth(time.Now())
		orgProfileCmd := &contracts.CreateOrgProfileDirectCommand{
			CompanyID:   company.ID,
			StartDate:   startDate,
			CompanyName: cmd.Name,
			ActorID:     cmd.ActorID,
		}

		_, txErr = mediator.Send[*contracts.CreateOrgProfileDirectCommand, *contracts.CreateOrgProfileDirectResponse](ctxTx, orgProfileCmd)
		if txErr != nil {
			logger.FromContext(ctx).Error("failed to create org profile", zap.Error(txErr), zap.String("company_id", company.ID.String()))
			return txErr
		}

		// 3. Create default payroll config via mediator
		configCmd := &contracts.CreatePayrollConfigDirectCommand{
			CompanyID: company.ID,
			StartDate: startDate,
			ActorID:   cmd.ActorID,
		}

		_, txErr = mediator.Send[*contracts.CreatePayrollConfigDirectCommand, *contracts.CreatePayrollConfigDirectResponse](ctxTx, configCmd)
		if txErr != nil {
			logger.FromContext(ctx).Error("failed to create payroll config", zap.Error(txErr), zap.String("company_id", company.ID.String()))
			return txErr
		}

		return nil
	})

	if err != nil {
		if _, ok := err.(*errs.AppError); ok {
			return nil, err
		}
		return nil, errs.Internal("failed to create company")
	}

	return &contracts.CreateCompanyResponse{
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

// getFirstDayOfMonth returns the first day of the given month
func getFirstDayOfMonth(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, t.Location())
}
