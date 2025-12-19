package create

import (
	"context"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/contracts"
	"hrms/shared/events"
)


type Command struct {
	Tx            transactor.Transactor
	Eb            eventbus.EventBus
	CompanyCode   string
	CompanyName   string
	AdminUsername string
	AdminPassword string
	ActorID       uuid.UUID
}

type Response struct {
	Company contracts.CompanyDTO `json:"company"`
	Branch  contracts.BranchDTO  `json:"branch"`
	AdminID uuid.UUID            `json:"adminUserId"`
}

type commandHandler struct{}

func NewHandler() *commandHandler {
	return &commandHandler{}
}

func (h *commandHandler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	var resp Response

	err := cmd.Tx.WithinTransaction(ctx, func(txCtx context.Context, registerHook func(transactor.PostCommitHook)) error {
		// 1. Create company via contract
		companyResp, err := mediator.Send[*contracts.CreateCompanyCommand, *contracts.CreateCompanyResponse](txCtx, &contracts.CreateCompanyCommand{
			Code:    cmd.CompanyCode,
			Name:    cmd.CompanyName,
			ActorID: cmd.ActorID,
		})
		if err != nil {
			logger.FromContext(ctx).Error("failed to create company", zap.Error(err))
			return errs.Internal("failed to create company")
		}
		resp.Company = *companyResp.Company

		// 2. Create default branch via contract
		branchResp, err := mediator.Send[*contracts.CreateDefaultBranchCommand, *contracts.CreateDefaultBranchResponse](txCtx, &contracts.CreateDefaultBranchCommand{
			CompanyID: resp.Company.ID,
			ActorID:   cmd.ActorID,
		})
		if err != nil {
			logger.FromContext(ctx).Error("failed to create default branch", zap.Error(err))
			return errs.Internal("failed to create default branch")
		}
		resp.Branch = *branchResp.Branch

		// 3. Create admin user via contract
		userResp, err := mediator.Send[*contracts.CreateUserWithPasswordCommand, *contracts.CreateUserWithPasswordResponse](txCtx, &contracts.CreateUserWithPasswordCommand{
			Username:      cmd.AdminUsername,
			PlainPassword: cmd.AdminPassword,
			Role:          "admin",
			ActorID:       cmd.ActorID,
		})
		if err != nil {
			logger.FromContext(ctx).Error("failed to create admin user", zap.Error(err))
			return errs.Internal("failed to create admin user")
		}
		resp.AdminID = userResp.UserID

		// 4. Assign admin to company via contract
		_, err = mediator.Send[*contracts.AssignUserToCompanyCommand, *contracts.AssignUserToCompanyResponse](txCtx, &contracts.AssignUserToCompanyCommand{
			UserID:    resp.AdminID,
			CompanyID: resp.Company.ID,
			Role:      "admin",
			ActorID:   cmd.ActorID,
		})
		if err != nil {
			logger.FromContext(ctx).Error("failed to assign user to company", zap.Error(err))
			return errs.Internal("failed to assign user to company")
		}

		// 5. Assign admin to default branch via contract
		_, err = mediator.Send[*contracts.AssignUserToBranchCommand, *contracts.AssignUserToBranchResponse](txCtx, &contracts.AssignUserToBranchCommand{
			UserID:   resp.AdminID,
			BranchID: resp.Branch.ID,
			ActorID:  cmd.ActorID,
		})
		if err != nil {
			logger.FromContext(ctx).Error("failed to assign user to branch", zap.Error(err))
			return errs.Internal("failed to assign user to branch")
		}

		registerHook(func(ctx context.Context) error {
			companyID := resp.Company.ID
			branchID := resp.Branch.ID
			cmd.Eb.Publish(events.LogEvent{
				ActorID:    cmd.ActorID,
				CompanyID:  &companyID,
				BranchID:   &branchID,
				Action:     "CREATE",
				EntityName: "COMPANY",
				EntityID:   companyID.String(),
				Details: map[string]interface{}{
					"code":          resp.Company.Code,
					"name":          resp.Company.Name,
					"status":        resp.Company.Status,
					"defaultBranch": resp.Branch.Code,
					"branchName":    resp.Branch.Name,
					"adminUserId":   resp.AdminID.String(),
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
