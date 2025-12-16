package feature

import (
	"context"

	"github.com/gofiber/fiber/v3"
	"go.uber.org/zap"

	"hrms/modules/dashboard/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// FinancialSummaryQuery is the query for financial summary
type FinancialSummaryQuery struct {
	Repo *repository.Repository
}

// PendingItemDTO is the DTO for pending items
type PendingItemDTO struct {
	Count       int     `json:"count"`
	TotalAmount float64 `json:"totalAmount"`
}

// FinancialSummaryResponse is the response for financial summary
type FinancialSummaryResponse struct {
	PendingAdvances          PendingItemDTO `json:"pendingAdvances"`
	PendingLoans             PendingItemDTO `json:"pendingLoans"`
	OutstandingInstallments  PendingItemDTO `json:"outstandingInstallments"`
	PendingBonusCycles       PendingItemDTO `json:"pendingBonusCycles"`
	PendingSalaryRaiseCycles PendingItemDTO `json:"pendingSalaryRaiseCycles"`
}

type financialSummaryHandler struct{}

func NewFinancialSummaryHandler() *financialSummaryHandler {
	return &financialSummaryHandler{}
}

func (h *financialSummaryHandler) Handle(ctx context.Context, q *FinancialSummaryQuery) (*FinancialSummaryResponse, error) {
	// Get pending advances
	advances, err := q.Repo.GetPendingAdvances(ctx)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get pending advances", zap.Error(err))
		return nil, errs.Internal("failed to get pending advances")
	}

	// Get pending loans
	loans, err := q.Repo.GetPendingLoans(ctx)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get pending loans", zap.Error(err))
		return nil, errs.Internal("failed to get pending loans")
	}

	// Get outstanding installments
	installments, err := q.Repo.GetOutstandingInstallments(ctx)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get outstanding installments", zap.Error(err))
		return nil, errs.Internal("failed to get outstanding installments")
	}

	// Get pending bonus cycles
	bonusCycles, err := q.Repo.GetPendingBonusCycles(ctx)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get pending bonus cycles", zap.Error(err))
		return nil, errs.Internal("failed to get pending bonus cycles")
	}

	// Get pending salary raise cycles
	salaryRaiseCycles, err := q.Repo.GetPendingSalaryRaiseCycles(ctx)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get pending salary raise cycles", zap.Error(err))
		return nil, errs.Internal("failed to get pending salary raise cycles")
	}

	return &FinancialSummaryResponse{
		PendingAdvances: PendingItemDTO{
			Count:       advances.Count,
			TotalAmount: advances.TotalAmount,
		},
		PendingLoans: PendingItemDTO{
			Count:       loans.Count,
			TotalAmount: loans.TotalAmount,
		},
		OutstandingInstallments: PendingItemDTO{
			Count:       installments.Count,
			TotalAmount: installments.TotalAmount,
		},
		PendingBonusCycles: PendingItemDTO{
			Count:       bonusCycles.Count,
			TotalAmount: bonusCycles.TotalAmount,
		},
		PendingSalaryRaiseCycles: PendingItemDTO{
			Count:       salaryRaiseCycles.Count,
			TotalAmount: salaryRaiseCycles.TotalAmount,
		},
	}, nil
}

// RegisterFinancialSummary registers the financial summary endpoint
// @Summary Get financial summary
// @Description Get pending financial items (advances, loans, bonus cycles, etc.)
// @Tags Dashboard
// @Produce json
// @Security BearerAuth
// @Success 200 {object} FinancialSummaryResponse
// @Failure 401
// @Failure 500
// @Router /dashboard/financial-summary [get]
func RegisterFinancialSummary(router fiber.Router, repo *repository.Repository) {
	router.Get("/financial-summary", func(c fiber.Ctx) error {
		resp, err := mediator.Send[*FinancialSummaryQuery, *FinancialSummaryResponse](c.Context(), &FinancialSummaryQuery{
			Repo: repo,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
