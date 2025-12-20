package update

import (
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/mediator"
	"hrms/shared/contracts"
	"hrms/shared/events"
)

// UpdateRequest for updating a company
type UpdateRequest struct {
	Code   string `json:"code"`
	Name   string `json:"name"`
	Status string `json:"status"`
}

// @Summary Update a company
// @Tags SuperAdmin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "company ID"
// @Param request body UpdateRequest true "company payload"
// @Success 200 {object} contracts.CompanyDTO
// @Router /super-admin/companies/{id} [patch]
func NewEndpoint(router fiber.Router, eb eventbus.EventBus) {
	router.Patch("/companies/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid company id")
		}

		var req UpdateRequest
		if err := c.Bind().JSON(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		user, _ := contextx.UserFromContext(c.Context())

		resp, err := mediator.Send[*contracts.UpdateCompanyByIDCommand, *contracts.UpdateCompanyByIDResponse](c.Context(), &contracts.UpdateCompanyByIDCommand{
			ID:      id,
			Code:    req.Code,
			Name:    req.Name,
			Status:  req.Status,
			ActorID: user.ID,
		})
		if err != nil {
			return err
		}

		// Publish log event
		eb.Publish(events.LogEvent{
			ActorID:    user.ID,
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

		return c.JSON(resp.Company)
	})
}
