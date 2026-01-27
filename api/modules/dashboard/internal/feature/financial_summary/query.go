package financial_summary

import (
	"context"

	"go.uber.org/zap"

	"hrms/modules/dashboard/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
)

type FinancialSummaryQuery struct{}

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

type financialSummaryHandler struct {
	repo *repository.Repository
}

func NewFinancialSummaryHandler(repo *repository.Repository) *financialSummaryHandler {
	return &financialSummaryHandler{repo: repo}
}

func (h *financialSummaryHandler) Handle(ctx context.Context, q *FinancialSummaryQuery) (*FinancialSummaryResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	// Get pending advances
	advances, err := h.repo.GetPendingAdvances(ctx, tenant)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get pending advances", zap.Error(err))
		return nil, errs.Internal("failed to get pending advances")
	}

	// Get pending loans
	loans, err := h.repo.GetPendingLoans(ctx, tenant)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get pending loans", zap.Error(err))
		return nil, errs.Internal("failed to get pending loans")
	}

	// Get outstanding installments
	installments, err := h.repo.GetOutstandingInstallments(ctx, tenant)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get outstanding installments", zap.Error(err))
		return nil, errs.Internal("failed to get outstanding installments")
	}

	// Get pending bonus cycles
	bonusCycles, err := h.repo.GetPendingBonusCycles(ctx, tenant)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get pending bonus cycles", zap.Error(err))
		return nil, errs.Internal("failed to get pending bonus cycles")
	}

	// Get pending salary raise cycles
	salaryRaiseCycles, err := h.repo.GetPendingSalaryRaiseCycles(ctx, tenant)
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
