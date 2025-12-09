## ADDED Requirements
### Requirement: Cancel part-time payout
The system SHALL allow admin or HR users to cancel a part-time payout that is still `to_pay` by soft-deleting it and reverting attached worklogs to `pending`.

#### Scenario: Cancel to_pay payout
- **WHEN** an authorized user requests cancellation for a payout in status `to_pay`
- **THEN** the payout is soft-deleted, the linked worklogs become available again, and the API returns 204 No Content

#### Scenario: Reject cancel for non-to_pay
- **WHEN** cancellation is requested for a payout that is already paid or missing
- **THEN** the API returns 400/404 and leaves the payout and worklogs unchanged
