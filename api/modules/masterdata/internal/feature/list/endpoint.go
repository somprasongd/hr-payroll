package list

import (
	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// ListEndpoints registers master data list routes
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
}
