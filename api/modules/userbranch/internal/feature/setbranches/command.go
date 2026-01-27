package setbranches

import (
	"context"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/userbranch/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/validator"
	"hrms/shared/events"
)

type Command struct {
	UserID    uuid.UUID   `validate:"required"`
	BranchIDs []uuid.UUID `validate:"required,min=1"`
	ActorID   uuid.UUID   `validate:"required"`
}

type Response struct {
	Branches []repository.BranchAccess `json:"branches"`
}

type commandHandler struct {
	repo repository.Repository
	eb   eventbus.EventBus
}

func NewHandler(eb eventbus.EventBus, repo repository.Repository) *commandHandler {
	return &commandHandler{eb: eb, repo: repo}
}

func (h *commandHandler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	if err := validator.Validate(cmd); err != nil {
		return nil, err
	}

	existing, err := h.repo.GetUserBranchAccess(ctx, cmd.UserID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get user branches before update", zap.Error(err))
		return nil, errs.Internal("failed to get user branches")
	}

	if err := h.repo.SetUserBranches(ctx, cmd.UserID, cmd.BranchIDs, cmd.ActorID); err != nil {
		logger.FromContext(ctx).Error("failed to set user branches", zap.Error(err))
		return nil, errs.Internal("failed to set user branches")
	}

	// Return updated branches
	branches, err := h.repo.GetUserBranchAccess(ctx, cmd.UserID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get user branches after update", zap.Error(err))
		return nil, errs.Internal("failed to get user branches")
	}

	oldIDs := make(map[uuid.UUID]struct{}, len(existing))
	for _, branch := range existing {
		oldIDs[branch.BranchID] = struct{}{}
	}
	newIDs := make(map[uuid.UUID]struct{}, len(branches))
	for _, branch := range branches {
		newIDs[branch.BranchID] = struct{}{}
	}

	addedIDs := make([]string, 0)
	for id := range newIDs {
		if _, ok := oldIDs[id]; !ok {
			addedIDs = append(addedIDs, id.String())
		}
	}
	removedIDs := make([]string, 0)
	for id := range oldIDs {
		if _, ok := newIDs[id]; !ok {
			removedIDs = append(removedIDs, id.String())
		}
	}

	branchIDs := make([]string, 0, len(branches))
	for _, branch := range branches {
		branchIDs = append(branchIDs, branch.BranchID.String())
	}

	var companyID *uuid.UUID
	if tenant, ok := contextx.TenantFromContext(ctx); ok {
		companyID = &tenant.CompanyID
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		CompanyID:  companyID,
		BranchID:   nil,
		Action:     "UPDATE",
		EntityName: "USER_BRANCH_ACCESS",
		EntityID:   cmd.UserID.String(),
		Details: map[string]interface{}{
			"userId":           cmd.UserID.String(),
			"branchIds":        branchIDs,
			"addedBranchIds":   addedIDs,
			"removedBranchIds": removedIDs,
		},
		Timestamp: time.Now(),
	})

	return &Response{Branches: branches}, nil
}
