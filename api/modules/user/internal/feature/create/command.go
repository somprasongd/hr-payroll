package create

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"go.uber.org/zap"

	"hrms/modules/user/internal/dto"
	"hrms/modules/user/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/password"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/common/validator"
	"hrms/shared/events"
)

type Command struct {
	Username string    `validate:"required"`
	Password string    `validate:"required"`
	Role     string    `validate:"required,oneof=admin hr timekeeper"`
	ActorID  uuid.UUID `validate:"required"`
}

type Response struct {
	dto.User
}

type Handler struct {
	repo repository.Repository
	tx   transactor.Transactor
	eb   eventbus.EventBus
}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository, tx transactor.Transactor, eb eventbus.EventBus) *Handler {
	return &Handler{
		repo: repo,
		tx:   tx,
		eb:   eb,
	}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	cmd.Username = strings.TrimSpace(cmd.Username)
	cmd.Role = strings.TrimSpace(cmd.Role)
	if err := validator.Validate(cmd); err != nil {
		return nil, err
	}

	hash, err := password.Hash(cmd.Password)
	if err != nil {
		logger.FromContext(ctx).Error("failed to hash password", zap.Error(err))
		return nil, errs.Internal("failed to hash password")
	}

	var created *repository.UserRecord
	var tenantCompanyID *uuid.UUID

	// Get company ID from tenant context before transaction
	if tenant, ok := contextx.TenantFromContext(ctx); ok {
		tenantCompanyID = &tenant.CompanyID
	}

	err = h.tx.WithinTransaction(ctx, func(ctxTx context.Context, hook func(transactor.PostCommitHook)) error {
		var err error
		created, err = h.repo.CreateUser(ctxTx, cmd.Username, hash, cmd.Role, cmd.ActorID)
		if err != nil {
			return err
		}

		// If created from company context, assign user to company
		if tenantCompanyID != nil {
			if err := h.repo.AssignUserToCompany(ctxTx, created.ID, *tenantCompanyID, cmd.Role, cmd.ActorID); err != nil {
				logger.FromContext(ctxTx).Error("failed to assign user to company", zap.Error(err))
				return errs.Internal("failed to assign user to company")
			}
		}

		hook(func(ctx context.Context) error {
			h.eb.Publish(events.LogEvent{
				ActorID:    cmd.ActorID,
				CompanyID:  tenantCompanyID,
				BranchID:   nil,
				Action:     "CREATE",
				EntityName: "USER",
				EntityID:   created.ID.String(),
				Details: map[string]interface{}{
					"username": created.Username,
					"role":     created.Role,
				},
				Timestamp: time.Now(),
			})
			return nil
		})

		return nil
	})
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			logger.FromContext(ctx).Warn("username already exists", zap.Error(err))
			return nil, errs.Conflict("username already exists")
		}
		logger.FromContext(ctx).Error("failed to create user", zap.Error(err))
		return nil, errs.Internal("failed to create user")
	}

	resp := dto.FromRecord(*created)
	return &Response{User: resp}, nil
}
