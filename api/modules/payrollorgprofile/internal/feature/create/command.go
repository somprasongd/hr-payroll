package create

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/payrollorgprofile/internal/dto"
	"hrms/modules/payrollorgprofile/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/events"
)

type Command struct {
	Payload RequestBody
	ActorID uuid.UUID
}

type Response struct {
	dto.Profile
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
	if err := validatePayload(cmd.Payload); err != nil {
		return nil, err
	}

	payload := cmd.Payload.ToPayload()
	// ensure explicit active when status not provided
	if payload.Status == nil || strings.TrimSpace(*payload.Status) == "" {
		active := "active"
		payload.Status = &active
	}

	var created *repository.Record
	err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		created, err = h.repo.Create(ctxTx, payload, cmd.ActorID)
		return err
	})
	if err != nil {
		logger.FromContext(ctx).Error("failed to create org profile", zap.Error(err))
		return nil, errs.Internal("failed to create org profile")
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		Action:     "CREATE",
		EntityName: "PAYROLL_ORG_PROFILE",
		EntityID:   created.ID.String(),
		Details: map[string]interface{}{
			"company_name":     created.CompanyName,
			"address_line1":    created.AddressLine1,
			"address_line2":    created.AddressLine2,
			"subdistrict":      created.Subdistrict,
			"district":         created.District,
			"province":         created.Province,
			"postal_code":      created.PostalCode,
			"phone_main":       created.PhoneMain,
			"phone_alt":        created.PhoneAlt,
			"email":            created.Email,
			"tax_id":           created.TaxID,
			"slip_footer_note": created.SlipFooterNote,
			"logo_id":          created.LogoID,
			"start_date":       created.StartDate,
			"end_date":         created.EndDate,
			"status":           created.Status,
			"effective_active": created.EffectiveActive,
		},
		Timestamp: time.Now(),
	})

	return &Response{Profile: dto.FromRecord(*created)}, nil
}
