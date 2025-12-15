package feature

import (
	"github.com/gofiber/fiber/v3"

	"hrms/modules/masterdata/internal/feature/department"
	"hrms/modules/masterdata/internal/feature/employeeposition"
	"hrms/shared/common/mediator"
	"hrms/shared/common/middleware"
	"hrms/shared/common/response"
)

// @Summary Get master data (person titles, employee types, id document types, departments, positions)
// @Tags Master
// @Produce json
// @Security BearerAuth
// @Success 200 {object} Response
// @Router /master/all [get]
// @Success 200 {object} Response
// @Router /master/person-titles [get]
// @Router /master/employee-types [get]
// @Router /master/id-document-types [get]
// @Router /master/departments [get]
// @Router /master/employee-positions [get]
func Register(router fiber.Router) {
	router.Get("/all", func(c fiber.Ctx) error {
		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
	router.Get("/person-titles", func(c fiber.Ctx) error {
		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{Only: "person_titles"})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.PersonTitles)
	})
	router.Get("/employee-types", func(c fiber.Ctx) error {
		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{Only: "employee_types"})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.EmployeeTypes)
	})
	router.Get("/id-document-types", func(c fiber.Ctx) error {
		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{Only: "id_document_types"})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.IDDocumentTypes)
	})
	router.Get("/departments", func(c fiber.Ctx) error {
		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{Only: "departments"})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Departments)
	})
	router.Get("/employee-positions", func(c fiber.Ctx) error {
		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{Only: "employee_positions"})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.EmployeePositions)
	})

	admin := router.Group("", middleware.RequireRoles("admin"))
	deptGroup := admin.Group("/departments")
	department.NewCreateEndpoint(deptGroup)
	department.NewUpdateEndpoint(deptGroup)
	department.NewDeleteEndpoint(deptGroup)

	posGroup := admin.Group("/employee-positions")
	employeeposition.NewCreateEndpoint(posGroup)
	employeeposition.NewUpdateEndpoint(posGroup)
	employeeposition.NewDeleteEndpoint(posGroup)
}
