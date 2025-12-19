## ADDED Requirements

### Requirement: Log user branch access updates
The system SHALL emit an activity log event when user branch access is updated via `PUT /api/v1/admin/users/{userId}/branches`.

#### Scenario: Admin updates a user's branch access
- **WHEN** an authenticated admin updates a user's branch access
- **THEN** a log event is emitted with action `UPDATE` and entity `USER_BRANCH_ACCESS`
- **AND** the event includes company context when available

### Requirement: Log event details
The log event details SHALL include `userId`, `branchIds`, `addedBranchIds`, and `removedBranchIds`.

#### Scenario: Log event includes branch changes
- **WHEN** a user branch access update is processed
- **THEN** the log event details contain the full set of branch IDs and the added/removed deltas
