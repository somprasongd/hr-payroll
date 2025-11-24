package feature

import (
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"

	"github.com/gofiber/fiber/v3"
)

// @Summary Get master data (person titles, employee types, id document types)
// @Tags Master
// @Produce json
// @Security BearerAuth
// @Success 200 {object} Response
// @Router /master/all [get]
// @Success 200 {object} Response
// @Router /master/person-titles [get]
// @Router /master/employee-types [get]
// @Router /master/id-document-types [get]
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
}
