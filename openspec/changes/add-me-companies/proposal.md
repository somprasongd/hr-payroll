# Change: Add /me/companies endpoint

## Why
The frontend calls `GET /api/v1/me/companies` to populate company context, but the API has no route, resulting in 404s.

## What Changes
- Add `GET /api/v1/me/companies` for authenticated users to list companies they can access.
- Return a JSON array of company records consistent with existing login payload fields.
- Update API documentation annotations for the new endpoint.

## Impact
- Affected specs: `me-companies`
- Affected code: `api/modules/user`, shared repository/handlers as needed, Swagger docs
