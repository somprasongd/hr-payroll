## ADDED Requirements

### Requirement: List companies for current user
The system SHALL provide `GET /api/v1/me/companies` to return companies the authenticated user can access.

#### Scenario: Authorized user requests companies
- **WHEN** an authenticated user calls `GET /api/v1/me/companies`
- **THEN** the response status is 200
- **AND** the response body is a JSON array of company records

#### Scenario: Unauthenticated request
- **WHEN** a request without a valid bearer token calls `GET /api/v1/me/companies`
- **THEN** the response status is 401

### Requirement: Company record fields
Each company record SHALL include `id`, `code`, `name`, `role`, and `status`.

#### Scenario: Company record includes required fields
- **WHEN** the API returns company records
- **THEN** each record contains `id`, `code`, `name`, `role`, and `status`
