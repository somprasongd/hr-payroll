# Change: Add part-time payout cancellation

## Why
Admins/HR need to cancel part-time payout slips that are still pending payment when selections are wrong.

## What Changes
- Add an API endpoint to cancel part-time payouts when status is `to_pay`
- Soft-delete the payout and release attached worklogs for reuse
- Document the new cancellation flow in the API specification

## Impact
- Affected specs: payout-pt
- Affected code: api/modules/payoutpt, docs/design/api_specification.md
