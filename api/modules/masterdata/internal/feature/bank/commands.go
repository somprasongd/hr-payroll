package bank

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"go.uber.org/zap"

	"hrms/modules/masterdata/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/events"
)

// ==========================================
// Commands and Responses
// ==========================================

type ListQuery struct {
	CompanyID uuid.UUID
	IsAdmin   bool // If true, returns all banks including disabled system banks
}

type ListResponse struct {
	Records []repository.BankRecord `json:"records"`
}

type ListSystemBanksQuery struct{}

type ListSystemBanksResponse struct {
	Records []repository.BankRecord `json:"records"`
}

type CreateCommand struct {
	IsSystem  bool
	CompanyID *uuid.UUID
	Code      string `json:"code"`
	NameTH    string `json:"nameTh"`
	NameEN    string `json:"nameEn"`
	NameMY    string `json:"nameMy"`
}

type UpdateCommand struct {
	ID        uuid.UUID
	IsSystem  bool
	CompanyID *uuid.UUID
	Code      string `json:"code"`
	NameTH    string `json:"nameTh"`
	NameEN    string `json:"nameEn"`
	NameMY    string `json:"nameMy"`
}

type DeleteCommand struct {
	ID        uuid.UUID
	IsSystem  bool
	CompanyID *uuid.UUID
}

type ToggleCommand struct {
	BankID    uuid.UUID `json:"bankId"`
	CompanyID uuid.UUID
	IsEnabled bool `json:"isEnabled"`
}

type Response struct {
	Record repository.BankRecord `json:"record"`
}

// ==========================================
// Handlers
// ==========================================

type ListHandler struct {
	repo repository.Repository
}

type ListSystemBanksHandler struct {
	repo repository.Repository
}

type CreateHandler struct {
	repo repository.Repository
	eb   eventbus.EventBus
}

type UpdateHandler struct {
	repo repository.Repository
	eb   eventbus.EventBus
}

type DeleteHandler struct {
	repo repository.Repository
	eb   eventbus.EventBus
}

type ToggleHandler struct {
	repo repository.Repository
	eb   eventbus.EventBus
}

// Interface compliance checks
var (
	_ mediator.RequestHandler[*ListQuery, *ListResponse]                       = (*ListHandler)(nil)
	_ mediator.RequestHandler[*ListSystemBanksQuery, *ListSystemBanksResponse] = (*ListSystemBanksHandler)(nil)
	_ mediator.RequestHandler[*CreateCommand, *Response]                       = (*CreateHandler)(nil)
	_ mediator.RequestHandler[*UpdateCommand, *Response]                       = (*UpdateHandler)(nil)
	_ mediator.RequestHandler[*DeleteCommand, mediator.NoResponse]             = (*DeleteHandler)(nil)
	_ mediator.RequestHandler[*ToggleCommand, mediator.NoResponse]             = (*ToggleHandler)(nil)
)

// Constructor functions
func NewListHandler(repo repository.Repository) *ListHandler {
	return &ListHandler{repo: repo}
}

func NewListSystemBanksHandler(repo repository.Repository) *ListSystemBanksHandler {
	return &ListSystemBanksHandler{repo: repo}
}

func NewCreateHandler(repo repository.Repository, eb eventbus.EventBus) *CreateHandler {
	return &CreateHandler{repo: repo, eb: eb}
}

func NewUpdateHandler(repo repository.Repository, eb eventbus.EventBus) *UpdateHandler {
	return &UpdateHandler{repo: repo, eb: eb}
}

func NewDeleteHandler(repo repository.Repository, eb eventbus.EventBus) *DeleteHandler {
	return &DeleteHandler{repo: repo, eb: eb}
}

func NewToggleHandler(repo repository.Repository, eb eventbus.EventBus) *ToggleHandler {
	return &ToggleHandler{repo: repo, eb: eb}
}

// ==========================================
// Handler Implementations
// ==========================================

func (h *ListHandler) Handle(ctx context.Context, query *ListQuery) (*ListResponse, error) {
	var records []repository.BankRecord
	var err error

	l := logger.FromContext(ctx).With(zap.String("companyId", query.CompanyID.String()), zap.Bool("isAdmin", query.IsAdmin))

	if query.IsAdmin {
		records, err = h.repo.BanksForAdmin(ctx, query.CompanyID)
	} else {
		records, err = h.repo.Banks(ctx, query.CompanyID)
	}
	if err != nil {
		l.Error("failed to list banks", zap.Error(err))
		return nil, errs.Internal("failed to list banks")
	}

	l.Debug("listed banks", zap.Int("count", len(records)))
	for _, r := range records {
		if r.Code == "BLL" {
			l.Info("debug bank status", zap.String("id", r.ID.String()), zap.Bool("enabled", r.IsEnabled))
		}
	}

	return &ListResponse{Records: records}, nil
}

func (h *ListSystemBanksHandler) Handle(ctx context.Context, _ *ListSystemBanksQuery) (*ListSystemBanksResponse, error) {
	records, err := h.repo.SystemBanks(ctx)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list system banks", zap.Error(err))
		return nil, errs.Internal("failed to list system banks")
	}
	return &ListSystemBanksResponse{Records: records}, nil
}

func (h *CreateHandler) Handle(ctx context.Context, cmd *CreateCommand) (*Response, error) {
	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing user context")
	}

	code := strings.TrimSpace(cmd.Code)
	nameTH := strings.TrimSpace(cmd.NameTH)
	nameEN := strings.TrimSpace(cmd.NameEN)
	nameMY := strings.TrimSpace(cmd.NameMY)

	if code == "" || nameTH == "" || nameEN == "" {
		return nil, errs.BadRequest("code, nameTh, and nameEn are required")
	}

	rec, err := h.repo.CreateBank(ctx, code, nameTH, nameEN, nameMY, cmd.IsSystem, cmd.CompanyID, user.ID)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, errs.Conflict("code already exists")
		}
		logger.FromContext(ctx).Error("failed to create bank", zap.Error(err))
		return nil, errs.Internal("failed to create bank")
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  cmd.CompanyID,
		Action:     "CREATE",
		EntityName: "BANK",
		EntityID:   rec.ID.String(),
		Details: map[string]interface{}{
			"code":     rec.Code,
			"nameTh":   rec.NameTH,
			"isSystem": rec.IsSystem,
		},
		Timestamp: time.Now(),
	})

	return &Response{Record: *rec}, nil
}

func (h *UpdateHandler) Handle(ctx context.Context, cmd *UpdateCommand) (*Response, error) {
	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing user context")
	}

	code := strings.TrimSpace(cmd.Code)
	nameTH := strings.TrimSpace(cmd.NameTH)
	nameEN := strings.TrimSpace(cmd.NameEN)
	nameMY := strings.TrimSpace(cmd.NameMY)

	if code == "" || nameTH == "" || nameEN == "" {
		return nil, errs.BadRequest("code, nameTh, and nameEn are required")
	}

	rec, err := h.repo.UpdateBank(ctx, cmd.ID, code, nameTH, nameEN, nameMY, cmd.IsSystem, cmd.CompanyID, user.ID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errs.NotFound("bank not found")
		}
		if isUniqueViolation(err) {
			return nil, errs.Conflict("code already exists")
		}
		logger.FromContext(ctx).Error("failed to update bank", zap.Error(err), zap.String("id", cmd.ID.String()))
		return nil, errs.Internal("failed to update bank")
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  cmd.CompanyID,
		Action:     "UPDATE",
		EntityName: "BANK",
		EntityID:   rec.ID.String(),
		Details: map[string]interface{}{
			"code":     rec.Code,
			"nameTh":   rec.NameTH,
			"isSystem": rec.IsSystem,
		},
		Timestamp: time.Now(),
	})

	return &Response{Record: *rec}, nil
}

func (h *DeleteHandler) Handle(ctx context.Context, cmd *DeleteCommand) (mediator.NoResponse, error) {
	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return mediator.NoResponse{}, errs.Unauthorized("missing user context")
	}

	if err := h.repo.SoftDeleteBank(ctx, cmd.ID, cmd.IsSystem, cmd.CompanyID, user.ID); err != nil {
		if err == sql.ErrNoRows {
			return mediator.NoResponse{}, errs.NotFound("bank not found")
		}
		logger.FromContext(ctx).Error("failed to delete bank", zap.Error(err), zap.String("id", cmd.ID.String()))
		return mediator.NoResponse{}, errs.Internal("failed to delete bank")
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  cmd.CompanyID,
		Action:     "DELETE",
		EntityName: "BANK",
		EntityID:   cmd.ID.String(),
		Timestamp:  time.Now(),
	})

	return mediator.NoResponse{}, nil
}

func (h *ToggleHandler) Handle(ctx context.Context, cmd *ToggleCommand) (mediator.NoResponse, error) {
	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return mediator.NoResponse{}, errs.Unauthorized("missing user context")
	}

	if err := h.repo.ToggleBankForCompany(ctx, cmd.BankID, cmd.CompanyID, cmd.IsEnabled, user.ID); err != nil {
		logger.FromContext(ctx).Error("failed to toggle bank", zap.Error(err), zap.String("bankId", cmd.BankID.String()))
		return mediator.NoResponse{}, errs.Internal("failed to toggle bank")
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &cmd.CompanyID,
		Action:     "TOGGLE",
		EntityName: "BANK_SETTING",
		EntityID:   cmd.BankID.String(),
		Details: map[string]interface{}{
			"isEnabled": cmd.IsEnabled,
		},
		Timestamp: time.Now(),
	})

	return mediator.NoResponse{}, nil
}

func isUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}
