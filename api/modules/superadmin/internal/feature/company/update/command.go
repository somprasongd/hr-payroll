package update

import (
	"context"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/contracts"
	"hrms/shared/events"
)

type Command struct {
	ID      uuid.UUID
	Code    string
	Name    string
	Status  string
	ActorID uuid.UUID
}

type Response struct {
	Company contracts.CompanyDTO `json:"company"`
}

type commandHandler struct {
	tx transactor.Transactor
	eb eventbus.EventBus
}

func NewHandler(tx transactor.Transactor, eb eventbus.EventBus) *commandHandler {
	return &commandHandler{
		tx: tx,
		eb: eb,
	}
}

func (h *commandHandler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	var resp Response

	err := h.tx.WithinTransaction(ctx, func(txCtx context.Context, registerHook func(transactor.PostCommitHook)) error {
		// Update company via contract
		updateResp, err := mediator.Send[*contracts.UpdateCompanyByIDCommand, *contracts.UpdateCompanyByIDResponse](txCtx, &contracts.UpdateCompanyByIDCommand{
			ID:      cmd.ID,
			Code:    cmd.Code,
			Name:    cmd.Name,
			Status:  cmd.Status,
			ActorID: cmd.ActorID,
		})
		if err != nil {
			logger.FromContext(ctx).Error("failed to update company", zap.Error(err))
			return err
		}
		resp.Company = *updateResp.Company

		registerHook(func(ctx context.Context) error {
			h.eb.Publish(events.LogEvent{
				ActorID:    cmd.ActorID,
				CompanyID:  nil,
				BranchID:   nil,
				Action:     "UPDATE",
				EntityName: "COMPANY",
				EntityID:   resp.Company.ID.String(),
				Details: map[string]interface{}{
					"code":   resp.Company.Code,
					"name":   resp.Company.Name,
					"status": resp.Company.Status,
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

	return &resp, nil
}
