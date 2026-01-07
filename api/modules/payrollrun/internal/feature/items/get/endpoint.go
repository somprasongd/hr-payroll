package itemsget

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/payrollrun/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary Get payroll item detail
// @Description ดูรายละเอียดสลิปพนักงาน
// @Tags Payroll Run
// @Produce json
// @Security BearerAuth
// @Param id path string true "item id"
// @Success 200 {object} GetResponse
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /payroll-items/{id} [get]
func NewEndpoint(router fiber.Router, repo repository.Repository) {
	router.Get("/:itemId", func(c fiber.Ctx) error {
		itemID, err := uuid.Parse(c.Params("itemId"))
		if err != nil {
			return errs.BadRequest("invalid item id")
		}
		resp, err := mediator.Send[*GetQuery, *GetResponse](c.Context(), &GetQuery{
			ID:   itemID,
			Repo: repo,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.ItemDetail)
	})
}
