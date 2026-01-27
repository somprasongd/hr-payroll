package pt

import (
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary List worklogs PT
// @Description รายการ worklog (Part-time)
// @Tags Worklogs PT
// @Produce json
// @Param page query int false "page"
// @Param limit query int false "limit"
// @Param employeeId query string false "employee id"
// @Param status query string false "pending|approved|all"
// @Param startDate query string false "YYYY-MM-DD"
// @Param endDate query string false "YYYY-MM-DD"
// @Security BearerAuth
// @Success 200 {object} ListResponse
// @Failure 400
// @Failure 401
// @Failure 403
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /worklogs/pt [get]
func Register(router fiber.Router) {
	handler := func(c fiber.Ctx) error {
		page, _ := strconv.Atoi(c.Query("page", "1"))
		limit, _ := strconv.Atoi(c.Query("limit", "20"))
		status := c.Query("status", "all")
		var empID *uuid.UUID
		if v := c.Query("employeeId"); v != "" {
			if id, err := uuid.Parse(v); err == nil {
				empID = &id
			} else {
				return errs.BadRequest("invalid employeeId")
			}
		}
		var startDate, endDate *time.Time
		if v := c.Query("startDate"); v != "" {
			d, err := time.Parse("2006-01-02", v)
			if err != nil {
				return errs.BadRequest("invalid startDate")
			}
			startDate = &d
		}
		if v := c.Query("endDate"); v != "" {
			d, err := time.Parse("2006-01-02", v)
			if err != nil {
				return errs.BadRequest("invalid endDate")
			}
			endDate = &d
		}

		resp, err := mediator.Send[*ListQuery, *ListResponse](c.Context(), &ListQuery{
			Page:       page,
			Limit:      limit,
			EmployeeID: empID,
			Status:     status,
			StartDate:  startDate,
			EndDate:    endDate,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	}

	// Support both /worklogs/pt and /worklogs/pt/
	router.Get("/", handler)
	router.Get("", handler)
	// additional routes
	registerGet(router)
	registerCreate(router)
	registerUpdate(router)
	registerDelete(router)
}

// @Summary Get worklog PT detail
// @Description ดึง worklog (Part-time) ตาม id
// @Tags Worklogs PT
// @Produce json
// @Param id path string true "worklog id"
// @Security BearerAuth
// @Success 200 {object} GetResponse
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /worklogs/pt/{id} [get]
func registerGet(router fiber.Router) {
	router.Get("/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}
		resp, err := mediator.Send[*GetQuery, *GetResponse](c.Context(), &GetQuery{
			ID: id,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.PTItem)
	})
}

// @Summary Create worklog PT
// @Description บันทึก worklog (Part-time)
// @Tags Worklogs PT
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateRequest true "worklog payload"
// @Success 201 {object} CreateResponse
// @Failure 400
// @Failure 401
// @Failure 403
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /worklogs/pt [post]
func registerCreate(router fiber.Router) {
	router.Post("/", func(c fiber.Ctx) error {
		var req CreateRequest
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}
		resp, err := mediator.Send[*CreateCommand, *CreateResponse](c.Context(), &CreateCommand{
			Payload: req,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusCreated, resp.PTItem)
	})
}

// @Summary Update worklog PT
// @Description แก้ไข worklog (Part-time). เปลี่ยนสถานะเป็น approved ได้, revert approved ไม่ได้
// @Tags Worklogs PT
// @Accept json
// @Produce json
// @Param id path string true "worklog id"
// @Param request body UpdateRequest true "worklog payload"
// @Security BearerAuth
// @Success 200 {object} UpdateResponse
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /worklogs/pt/{id} [patch]
func registerUpdate(router fiber.Router) {
	router.Patch("/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}
		var req UpdateRequest
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}
		resp, err := mediator.Send[*UpdateCommand, *UpdateResponse](c.Context(), &UpdateCommand{
			ID:      id,
			Payload: req,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.PTItem)
	})
}

// @Summary Delete worklog PT
// @Description ลบ worklog (Part-time) ได้เฉพาะสถานะ pending
// @Tags Worklogs PT
// @Security BearerAuth
// @Param id path string true "worklog id"
// @Success 204 "No Content"
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /worklogs/pt/{id} [delete]
func registerDelete(router fiber.Router) {
	router.Delete("/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}
		if _, err := mediator.Send[*DeleteCommand, mediator.NoResponse](c.Context(), &DeleteCommand{
			ID: id,
		}); err != nil {
			return err
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
}
