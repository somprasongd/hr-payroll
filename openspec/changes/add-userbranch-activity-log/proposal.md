# Change: Add activity logging for user branch access

## Why
User branch access changes are not recorded in activity logs, reducing auditability of permission updates.

## What Changes
- Publish an activity log event when user branch access is updated via `PUT /admin/users/{userId}/branches`.
- Log details include `userId`, `branchIds`, `addedBranchIds`, and `removedBranchIds`.

## Impact
- Affected specs: `userbranch-activity-log`
- Affected code: `api/modules/userbranch/internal/feature/setbranches`, event logging utilities
