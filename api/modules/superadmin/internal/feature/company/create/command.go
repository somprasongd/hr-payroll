package create

import (
	"context"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/common/validator"
	"hrms/shared/contracts"
	"hrms/shared/events"
)

type Command struct {
	CompanyCode   string
	CompanyName   string    `validate:"required"`
	AdminUsername string    `validate:"required"`
	AdminPassword string    `validate:"required,min=8"`
	ActorID       uuid.UUID `validate:"required"`
}

type Response struct {
	Company contracts.CompanyDTO `json:"company"`
	Branch  contracts.BranchDTO  `json:"branch"`
	AdminID uuid.UUID            `json:"adminUserId"`
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

	if cmd.CompanyCode == "" {
		cmd.CompanyCode = generateRandomCode(5)
	}

	if err := validator.Validate(cmd); err != nil {
		return nil, err
	}

	err := h.tx.WithinTransaction(ctx, func(txCtx context.Context, registerHook func(transactor.PostCommitHook)) error {
		// 1. Create company via contract
		companyResp, err := mediator.Send[*contracts.CreateCompanyCommand, *contracts.CreateCompanyResponse](txCtx, &contracts.CreateCompanyCommand{
			Code:    cmd.CompanyCode,
			Name:    cmd.CompanyName,
			ActorID: cmd.ActorID,
		})
		if err != nil {
			logger.FromContext(ctx).Error("failed to create company", zap.Error(err))
			if errs.IsConflict(err) {
				return err
			}
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
			if errs.IsConflict(err) {
				return errs.Conflict("duplicate admin user")
			}
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
			h.eb.Publish(events.LogEvent{
				ActorID:    cmd.ActorID,
				CompanyID:  nil,
				BranchID:   nil,
				Action:     "CREATE",
				EntityName: "COMPANY",
				EntityID:   resp.Company.ID.String(),
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

func generateRandomCode(length int) string {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[time.Now().UnixNano()%int64(len(charset))]
		// Add a small sleep or ensuring seed change if called rapidly in loop (unlikely here)
		// Or verify uniqueness. For this use case, simple random is enough as per collision probability.
		// A better way is using crypto/rand but math/rand seeded is okay for this non-security ID.
		// Since we use time.Now().UnixNano() directly in older go versions or math/rand,
		// let's stick to simple implementation.
		// Re-seeding via modulo of time for every char is a bit weird but works for single call.
		// Better approach:
	}
	// Let's use a cleaner implementation
	seededRand := rand.New(rand.NewSource(time.Now().UnixNano()))
	for i := range b {
		b[i] = charset[seededRand.Intn(len(charset))]
	}
	return string(b)
}
