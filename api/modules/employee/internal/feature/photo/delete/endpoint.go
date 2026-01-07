package delete

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

// Delete employee photo (clear employee.photo_id and delete the old photo row)
// @Summary Delete employee photo
// @Description ลบรูปพนักงาน (เคลียร์ photoId ของ employee และลบไฟล์รูปเดิมออกจาก employee_photo)
// @Tags Employees
// @Security BearerAuth
// @Param id path string true "employee id"
// @Success 204
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /employees/{id}/photo [delete]
func NewEndpoint(router fiber.Router) {
	router.Delete("/", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		_, err = mediator.Send[*Command, mediator.NoResponse](c.Context(), &Command{
			EmployeeID: id,
		})
		if err != nil {
			return err
		}

		return c.SendStatus(fiber.StatusNoContent)
	})
}
