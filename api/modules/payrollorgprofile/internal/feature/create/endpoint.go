package create

import (
	"log"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/payrollorgprofile/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

type RequestBody struct {
	StartDate      string     `json:"startDate" validate:"required"`
	CompanyName    string     `json:"companyName" validate:"required"`
	AddressLine1   *string    `json:"addressLine1,omitempty"`
	AddressLine2   *string    `json:"addressLine2,omitempty"`
	Subdistrict    *string    `json:"subdistrict,omitempty"`
	District       *string    `json:"district,omitempty"`
	Province       *string    `json:"province,omitempty"`
	PostalCode     *string    `json:"postalCode,omitempty"`
	PhoneMain      *string    `json:"phoneMain,omitempty"`
	PhoneAlt       *string    `json:"phoneAlt,omitempty"`
	Email          *string    `json:"email,omitempty" validate:"omitempty,email"`
	TaxID          *string    `json:"taxId,omitempty"`
	SlipFooterNote *string    `json:"slipFooterNote,omitempty"`
	LogoID         *uuid.UUID `json:"logoId,omitempty"`
	Status         *string    `json:"status,omitempty" validate:"omitempty,oneof=active retired"`

	parsedStartDate time.Time `json:"-"`
}

func (p RequestBody) ToPayload() repository.UpsertPayload {
	return repository.UpsertPayload{
		StartDate:      &p.parsedStartDate,
		CompanyName:    stringPtr(strings.TrimSpace(p.CompanyName)),
		AddressLine1:   normalizeStr(p.AddressLine1),
		AddressLine2:   normalizeStr(p.AddressLine2),
		Subdistrict:    normalizeStr(p.Subdistrict),
		District:       normalizeStr(p.District),
		Province:       normalizeStr(p.Province),
		PostalCode:     normalizeStr(p.PostalCode),
		PhoneMain:      normalizeStr(p.PhoneMain),
		PhoneAlt:       normalizeStr(p.PhoneAlt),
		Email:          normalizeStr(p.Email),
		TaxID:          normalizeStr(p.TaxID),
		SlipFooterNote: normalizeStr(p.SlipFooterNote),
		LogoID:         p.LogoID,
		Status:         normalizeStr(p.Status),
	}
}

// Create payroll org profile
// @Summary Create payroll org profile
// @Description สร้างโปรไฟล์หัวสลิปเงินเดือนแบบเวอร์ชัน (daterange)
// @Tags Payroll Org Profile
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body RequestBody true "profile payload"
// @Success 201 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /admin/payroll-org-profiles [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/", func(c fiber.Ctx) error {
		var req RequestBody
		if err := c.Bind().Body(&req); err != nil {
			log.Println(err)
			return errs.BadRequest("invalid request body")
		}

		parsedStart, err := time.Parse("2006-01-02", strings.TrimSpace(req.StartDate))
		if err != nil {
			return errs.BadRequest("startDate must be in format YYYY-MM-DD")
		}
		req.parsedStartDate = parsedStart

		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			Payload: req,
			ActorID: user.ID,
		})
		if err != nil {
			return err
		}

		return response.JSON(c, fiber.StatusCreated, resp.Profile)
	})
}

func validatePayload(p RequestBody) error {
	if strings.TrimSpace(p.CompanyName) == "" {
		return errs.BadRequest("companyName is required")
	}
	if p.parsedStartDate.IsZero() {
		return errs.BadRequest("startDate is required (YYYY-MM-DD)")
	}

	if p.Status != nil {
		val := strings.TrimSpace(*p.Status)
		if val != "" && val != "active" && val != "retired" {
			return errs.BadRequest("status must be active or retired")
		}
	}
	return nil
}

func normalizeStr(v *string) *string {
	if v == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*v)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func stringPtr(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}
